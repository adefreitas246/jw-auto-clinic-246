// app/auth/login.tsx
import { SECURE_STORE_KEYS } from "@/constants/secureStoreKeys";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Colors } from '@/constants/Colors';

// Required for expo-auth-session on native
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Biometrics state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);

  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const isSmallScreen = height < 700;

  // ── Google OAuth ─────────────────────────────────────────────
  // expo-auth-session does not accept null — always pass strings.
  // Placeholder values satisfy the hook; googleEnabled gates the actual flow.
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "placeholder-android";
  const iosClientId     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? "placeholder-ios";
  const webClientId     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     ?? "placeholder-web";

  // Only requires native client IDs — web ID is optional for native apps
  const googleEnabled = (
    androidClientId !== "placeholder-android" &&
    iosClientId     !== "placeholder-ios"
  );

  const [_googleRequest, googleResponse, promptGoogleAsync] =
    Google.useAuthRequest({ androidClientId, iosClientId, webClientId, scopes: ["profile", "email"] });

  useEffect(() => {
    if (!googleEnabled) return;
    if (googleResponse?.type === "success") {
      const token = googleResponse.authentication?.accessToken;
      if (token) handleOAuthLogin("google", () => loginWithGoogle(token));
    } else if (googleResponse?.type === "error") {
      setOauthLoading(null);
      Alert.alert("Google Sign-In Failed", googleResponse.error?.message ?? "Try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse, googleEnabled]);

  // ── Apple Sign-In handler (iOS only) ─────────────────────────
  const handleAppleLogin = async (identityToken: string | null) => {
    if (!identityToken) return;
    await handleOAuthLogin("apple", () => loginWithApple(identityToken));
  };

  // ── Shared OAuth success handler ──────────────────────────────
  const handleOAuthLogin = async (
    provider: "google" | "apple",
    loginFn: () => Promise<void>,
  ) => {
    try {
      setOauthLoading(provider);
      await loginFn();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await navigateAfterLogin();
    } catch (error: any) {
      const message = error?.response?.data?.error ?? "Sign-in failed. Please try again.";
      Alert.alert("Sign-In Failed", message);
    } finally {
      setOauthLoading(null);
    }
  };

  // ── Navigate to correct stack based on role ───────────────────
  const navigateAfterLogin = async () => {
    const role =
      Platform.OS === "web"
        ? await AsyncStorage.getItem(SECURE_STORE_KEYS.USER_ROLE)
        : await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_ROLE);
    const dest = role === "customer" ? "/(customer)/home" : "/(tabs)/home";
    router.replace(dest);
  };

  // ── Load stored credentials ───────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const savedEmail    = await AsyncStorage.getItem("@rememberedEmail");
        const savedPassword = await AsyncStorage.getItem("@rememberedPassword");
        const savedUseBio   = await AsyncStorage.getItem("@useBiometrics");
        if (savedEmail)   { setEmail(savedEmail); setRememberMe(true); }
        if (savedPassword)  setPassword(savedPassword);
        setHasStoredCredentials(!!(savedEmail && savedPassword));
        if (savedUseBio === "true") setBiometricEnabled(true);
      } catch {}
    })();
  }, []);

  // ── Check biometric hardware ──────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled    = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHardware && enrolled);
      } catch { setBiometricAvailable(false); }
    })();
  }, [isNative]);

  // ── Email/password login ──────────────────────────────────────
  const handleLogin = async (overrideEmail?: string, overridePassword?: string) => {
    const loginEmail    = overrideEmail    ?? email;
    const loginPassword = overridePassword ?? password;

    const emailMissing    = !loginEmail;
    const passwordMissing = !loginPassword;
    setEmailError(emailMissing);
    setPasswordError(passwordMissing);

    if (emailMissing || passwordMissing) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }
    try {
      setLoading(true);
      if (rememberMe) {
        await AsyncStorage.setItem("@rememberedEmail",    loginEmail);
        await AsyncStorage.setItem("@rememberedPassword", loginPassword);
        setHasStoredCredentials(true);
      } else {
        await AsyncStorage.removeItem("@rememberedEmail");
        await AsyncStorage.removeItem("@rememberedPassword");
        setHasStoredCredentials(false);
      }
      await login(loginEmail, loginPassword);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await navigateAfterLogin();
    } catch (error: any) {
      const message = error?.response?.data?.error ?? "Invalid credentials or server error.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric login ───────────────────────────────────────────
  const handleBiometricLogin = async () => {
    if (!isNative) return;
    if (!biometricEnabled) {
      Alert.alert("Biometric login not enabled", "Turn on biometric login in Settings first.");
      return;
    }
    if (!biometricAvailable) {
      Alert.alert("Biometrics not available", "This device does not support biometric authentication.");
      return;
    }
    try {
      const savedEmail    = await AsyncStorage.getItem("@rememberedEmail");
      const savedPassword = await AsyncStorage.getItem("@rememberedPassword");
      if (!savedEmail || !savedPassword) {
        setHasStoredCredentials(false);
        Alert.alert("Biometric login not ready", "Please log in once with your email and password first.");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         "Login with biometrics",
        fallbackLabel:         Platform.OS === "ios" ? "Use passcode" : "Use device PIN",
        cancelLabel:           "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        await handleLogin(savedEmail, savedPassword);
      }
    } catch {
      Alert.alert("Biometric error", "We couldn't complete biometric authentication.");
    }
  };

  const anyLoading = loading || oauthLoading !== null;

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
      {isNative && (
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} translucent={false} />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <TouchableWithoutFeedback onPress={Platform.OS !== "web" ? Keyboard.dismiss : undefined}>
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              isNative && {
                paddingTop:    isSmallScreen ? 16 : 32,
                paddingBottom: (insets.bottom || 16) + (isSmallScreen ? 16 : 32),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.formContainer}>
              {/* Logo */}
              <Image
                source={require("@/assets/images/icon.png")}
                style={[s.logo, isSmallScreen && s.logoSmall]}
                resizeMode="contain"
              />

              {/* Heading */}
              <Text style={s.heading}>Welcome Back</Text>
              <Text style={s.subtext}>Sign in to continue to Wash Hub</Text>

              {/* ── Email ── */}
              <Text style={s.label}>Email Address</Text>
              <Animatable.View ref={emailRef} animation={emailError ? "shake" : undefined}>
                <TextInput
                  style={[s.input, emailError && s.inputError]}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={(t) => { setEmail(t); if (emailError && t) setEmailError(false); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                  returnKeyType="next"
                />
              </Animatable.View>

              {/* ── Password ── */}
              <Text style={s.label}>Password</Text>
              <Animatable.View
                ref={passwordRef}
                animation={passwordError ? "shake" : undefined}
                style={[s.passwordContainer, passwordError && s.inputError]}
              >
                <TextInput
                  style={s.passwordInput}
                  placeholder="Your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={hidePassword}
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (passwordError && t) setPasswordError(false); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={() => handleLogin()}
                />
                <Pressable onPress={() => setHidePassword((p) => !p)} accessibilityLabel="Toggle password visibility" hitSlop={8}>
                  <Ionicons name={hidePassword ? "eye-outline" : "eye"} size={22} color={Colors.textMuted} />
                </Pressable>
              </Animatable.View>

              {/* ── Remember Me + Forgot ── */}
              <View style={s.rememberRow}>
                <Pressable onPress={() => setRememberMe((p) => !p)} hitSlop={8} style={s.rememberCheck}>
                  <Ionicons
                    name={rememberMe ? "checkbox" : "square-outline"}
                    size={22}
                    color={Colors.accent}
                  />
                  <Text style={s.rememberLabel}>Remember Me</Text>
                </Pressable>
                <TouchableOpacity onPress={() => router.push("/auth/forgot")} disabled={anyLoading}>
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* ── Sign In Button ── */}
              <TouchableOpacity
                style={[s.primaryBtn, anyLoading && s.disabled]}
                onPress={() => handleLogin()}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.primaryBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* ── Biometric ── */}
              {isNative && biometricEnabled && biometricAvailable && (
                <TouchableOpacity
                  style={[s.secondaryBtn, anyLoading && s.disabled]}
                  onPress={handleBiometricLogin}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="finger-print-outline" size={20} color={Colors.accent} />
                  <Text style={s.secondaryBtnText}>Login with Biometrics</Text>
                </TouchableOpacity>
              )}

              {/* ── OAuth divider ── */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or continue with</Text>
                <View style={s.dividerLine} />
              </View>

              {/* ── Google Sign-In — all platforms ── */}
              {googleEnabled ? (
                <TouchableOpacity
                  style={[s.oauthBtn, anyLoading && s.disabled]}
                  onPress={() => { setOauthLoading("google"); promptGoogleAsync(); }}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                >
                  {oauthLoading === "google" ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <>
                      <Text style={s.googleG}>G</Text>
                      <Text style={s.oauthBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : __DEV__ ? (
                <TouchableOpacity style={[s.oauthBtn, s.disabled]} disabled activeOpacity={1}>
                  <Text style={s.googleG}>G</Text>
                  <View>
                    <Text style={s.oauthBtnText}>Continue with Google</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center' }}>Configure .env to enable</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* ── Apple Sign-In — iOS only ── */}
              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={s.appleBtn}
                  onPress={async () => {
                    try {
                      const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                          AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                      });
                      await handleAppleLogin(credential.identityToken);
                    } catch (error: any) {
                      if (error.code !== "ERR_REQUEST_CANCELED") {
                        Alert.alert("Apple Sign-In Failed", error.message ?? "Try again.");
                      }
                    }
                  }}
                />
              )}

              {/* ── Register link ── */}
              <View style={s.registerRow}>
                <Text style={s.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/auth/forgot")}>
                  <Text style={s.registerLink}>Contact your admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  formContainer: { width: '100%', maxWidth: 420, alignSelf: 'center' },

  // Logo
  logo:      { width: 300, height: 160, borderRadius: 24, alignSelf: 'center', marginBottom: 24 },
  logoSmall: { width: 220, height: 120, borderRadius: 16 },

  // Heading
  heading: {
    fontSize: 26, fontWeight: '800', textAlign: 'center',
    color: Colors.textPrimary, marginBottom: 6,
  },
  subtext: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 28,
  },

  // Inputs
  label: {
    fontSize: 13, fontWeight: '600',
    color: Colors.textSecondary, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: Colors.textPrimary,
    marginBottom: 16,
  },
  inputError: { borderColor: Colors.error, borderWidth: 1.5 },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14,
    marginBottom: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.textPrimary },

  // Remember + forgot row
  rememberRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 24,
  },
  rememberCheck: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rememberLabel: { fontSize: 14, color: Colors.textSecondary },
  forgotText:    { fontSize: 14, color: Colors.accent, fontWeight: '600' },

  // Buttons
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.accent,
    borderRadius: 12, paddingVertical: 13, marginBottom: 12,
  },
  secondaryBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },

  disabled: { opacity: 0.5 },

  // OAuth divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: Colors.textMuted },

  // OAuth buttons
  oauthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 13, marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  googleG:     { fontSize: 16, fontWeight: '800', color: Colors.accent, width: 20, textAlign: 'center' },
  oauthBtnText:{ fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  appleBtn: { width: '100%', height: 50, marginBottom: 12 },

  // Register
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerLink: { fontSize: 14, color: Colors.accent, fontWeight: '600' },
});
