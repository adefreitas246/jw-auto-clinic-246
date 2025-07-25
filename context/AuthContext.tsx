// context/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type User = {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  token: string;
  phone?: string;
  avatar?: string | null;
  notificationsEnabled?: boolean;
};

interface AuthContextProps {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword?: (token: string, password: string) => Promise<void>; // optional for now
}

const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const jsonValue = await AsyncStorage.getItem('@user');
      if (jsonValue) {
        const parsed = JSON.parse(jsonValue);
        axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;
        await fetchUserProfile(parsed.token); // re-fetch on launch
      }
      setLoading(false);
    };    
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await axios.post('http://192.168.1.29:5000/api/auth/login', {
      email,
      password,
    });
  
    const userData = response.data;
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    await fetchUserProfile(userData.token); // pull profile after login
  };
  

  const logout = async () => {
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    await AsyncStorage.removeItem('@user');
  };

  const updateProfile = async (profileData: Partial<User>) => {
    if (!user) throw new Error('No user logged in');
  
    try {
      const response = await axios.put('http://192.168.1.29:5000/api/profile', profileData, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
  
      const updatedUser = { ...user, ...response.data };
      setUser(updatedUser);
      await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await axios.get('http://192.168.1.29:5000/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const updatedUser = { ...user, ...res.data, token };
      setUser(updatedUser);
      await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await axios.post('http://192.168.1.29:5000/api/auth/forgot-password', {
        email,
      });
  
      if (!res.data.message?.toLowerCase().includes('reset')) {
        throw new Error(res.data?.error || 'Unexpected response');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Request failed';
      throw new Error(msg);
    }
  };  

  const resetPassword = async (token: string, password: string) => {
    try {
      const res = await axios.post('http://192.168.1.29:5000/api/auth/reset-password', {
        token,
        password,
      });
  
      if (!res.data.message?.toLowerCase().includes('success')) {
        throw new Error(res.data?.error || 'Unexpected response');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Reset failed';
      throw new Error(msg);
    }
  };  
  

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateProfile, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
