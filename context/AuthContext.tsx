// context/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { SECURE_STORE_KEYS } from '@/constants/secureStoreKeys';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type UserRole = 'admin' | 'staff' | 'customer';

export type User = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  token: string;
  businessId?: string;
  phone?: string;
  avatar?: string | null;
  notificationsEnabled?: boolean;
};

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

// ─────────────────────────────────────────────
// SecureStore helpers (web falls back to AsyncStorage)
// ─────────────────────────────────────────────
const secureGet = (key: string): Promise<string | null> =>
  Platform.OS === 'web'
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key);

const secureSet = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
};

const secureDelete = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
};

// ─────────────────────────────────────────────
// Axios global setup
// ─────────────────────────────────────────────
axios.defaults.baseURL =
  process.env.EXPO_PUBLIC_API_URL || 'https://jw-auto-clinic-246.onrender.com';
axios.defaults.headers.common['Accept'] = 'application/json';

let isHandling401 = false;
axios.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
      try {
        await Promise.all([
          secureDelete(SECURE_STORE_KEYS.AUTH_TOKEN),
          secureDelete(SECURE_STORE_KEYS.USER_ROLE),
          secureDelete(SECURE_STORE_KEYS.BUSINESS_ID),
          AsyncStorage.removeItem('@user'),
        ]);
      } catch {}
      delete axios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['x-business-id'];
    }
    isHandling401 = false;
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  // Write sensitive fields to SecureStore; full profile to AsyncStorage
  const persistUser = async (userData: User) => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    if (userData.businessId) {
      axios.defaults.headers.common['x-business-id'] = userData.businessId;
    } else {
      delete axios.defaults.headers.common['x-business-id'];
    }
    await Promise.all([
      secureSet(SECURE_STORE_KEYS.AUTH_TOKEN, userData.token),
      secureSet(SECURE_STORE_KEYS.USER_ROLE, userData.role),
      secureSet(SECURE_STORE_KEYS.BUSINESS_ID, userData.businessId ?? ''),
      AsyncStorage.setItem('@user', JSON.stringify(userData)),
    ]);
    setUser(userData);
  };

  const clearUser = async () => {
    await Promise.all([
      secureDelete(SECURE_STORE_KEYS.AUTH_TOKEN),
      secureDelete(SECURE_STORE_KEYS.USER_ROLE),
      secureDelete(SECURE_STORE_KEYS.BUSINESS_ID),
      AsyncStorage.removeItem('@user'),
    ]);
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['x-business-id'];
    setUser(null);
  };

  // Hydrate session from SecureStore on launch
  useEffect(() => {
    (async () => {
      try {
        const token = await secureGet(SECURE_STORE_KEYS.AUTH_TOKEN);
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          await fetchUserProfile(token);
        }
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh JWT when app resumes from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        const token = await secureGet(SECURE_STORE_KEYS.AUTH_TOKEN);
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          fetchUserProfile(token).catch(() => {});
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await axios.get('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      await persistUser({ ...res.data, token } as User);
    } catch {
      await clearUser();
    }
  };

  // ── Auth methods ──────────────────────────

  const login = async (email: string, password: string) => {
    const res = await axios.post('/api/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    await fetchUserProfile(res.data.token);
  };

  /**
   * Called after expo-auth-session returns a Google accessToken.
   * Backend verifies the token, finds/creates the user, and returns a JWT.
   */
  const loginWithGoogle = async (accessToken: string) => {
    const res = await axios.post('/api/auth/google', { accessToken });
    await fetchUserProfile(res.data.token);
  };

  /**
   * Called after expo-auth-session returns an Apple identityToken.
   * fullName is only provided on the FIRST sign-in; store it server-side.
   */
  const loginWithApple = async (identityToken: string, fullName?: string) => {
    const res = await axios.post('/api/auth/apple', { identityToken, fullName });
    await fetchUserProfile(res.data.token);
  };

  const logout = async () => {
    await clearUser();
  };

  const updateProfile = async (profileData: Partial<User>) => {
    if (!user) throw new Error('No user logged in');
    const res = await axios.put('/api/profile', profileData, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    await persistUser({ ...user, ...res.data });
  };

  const forgotPassword = async (email: string) => {
    const res = await axios.post('/api/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
    if (!res.data.message?.toLowerCase().includes('reset')) {
      throw new Error(res.data?.error || 'Unexpected response');
    }
  };

  const resetPassword = async (token: string, password: string) => {
    const res = await axios.post('/api/auth/reset-password', { token, password });
    if (!res.data.message?.toLowerCase().includes('success')) {
      throw new Error(res.data?.error || 'Reset failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        loginWithApple,
        logout,
        updateProfile,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
