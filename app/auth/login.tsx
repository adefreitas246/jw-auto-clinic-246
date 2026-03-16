// app/auth/login.tsx
import { SECURE_STORE_KEYS } from "@/constants/secureStoreKeys";
import { Colors } from "@/constants/Colors";
import { IS_ANDROID, IS_IOS, SUPPORTS_LIQUID_GLASS } from "@/constants/Platform";
import { Typography } from "@/constants/Typography";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
import Animated, {
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "placeholder-android";
  const iosClientId     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? "placeholder-ios";
  const webClientId     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     ?? "placeholder-web";

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
    <View style={s.root}>
      {isNative && (
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
      )}

      <KeyboardAvoidingView
        style={s.kvFill}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Platform.OS !== "web" ? Keyboard.dismiss : undefined}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* ── Top gradient hero ── */}
            <Animated.View entering={FadeIn.duration(400)} style={s.hero}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <SafeAreaView style={s.heroInner}>
                <View style={s.logoCircle}>
                  <Ionicons name="water" size={48} color={Colors.white} />
                </View>
                <Text style={s.heroTitle}>Wash Hub</Text>
                <Text style={s.heroSubtitle}>Professional Car Wash</Text>
              </SafeAreaView>
            </Animated.View>

            {/* ── White card ── */}
            <Animated.View entering={FadeInUp.duration(500).delay(100)} style={s.card}>
              <Text style={s.cardHeading}>Welcome back</Text>
              <Text style={s.cardSubtext}>Sign in to continue</Text>

              {/* ── Email ── */}
              <Text style={s.label}>Email</Text>
              <Animatable.View ref={emailRef} animation={emailError ? "shake" : undefined}>
                <View style={[s.inputWrapper, emailError && s.inputError]}>
                  <Ionicons name="mail-outline" size={18} color={emailError ? Colors.error : Colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
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
                </View>
              </Animatable.View>

              {/* ── Password ── */}
              <Text style={s.label}>Password</Text>
              <Animatable.View ref={passwordRef} animation={passwordError ? "shake" : undefined}>
                <View style={[s.inputWrapper, passwordError && s.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={passwordError ? Colors.error : Colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
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
                  <Pressable
                    onPress={() => setHidePassword((p) => !p)}
                    accessibilityLabel="Toggle password visibility"
                    hitSlop={8}
                    android_ripple={{ color: Colors.accentMuted, borderless: true }}
                  >
                    <Ionicons
                      name={hidePassword ? "eye-outline" : "eye"}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </Pressable>
                </View>
              </Animatable.View>

              {/* ── Forgot password row ── */}
              <View style={s.forgotRow}>
                <Pressable
                  onPress={() => setRememberMe((p) => !p)}
                  hitSlop={8}
                  style={s.rememberCheck}
                  android_ripple={{ color: Colors.accentMuted, borderless: true }}
                >
                  <Ionicons
                    name={rememberMe ? "checkbox" : "square-outline"}
                    size={20}
                    color={Colors.accent}
                  />
                  <Text style={s.rememberLabel}>Remember Me</Text>
                </Pressable>
                <TouchableOpacity onPress={() => router.push("/auth/forgot")} disabled={anyLoading}>
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* ── Sign In Button ── */}
              <Pressable
                style={({ pressed }) => [s.primaryBtn, (pressed || anyLoading) && s.primaryBtnPressed]}
                onPress={() => handleLogin()}
                disabled={anyLoading}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.primaryBtnText}>Sign In</Text>
                )}
              </Pressable>

              {/* ── Biometric ── */}
              {isNative && biometricEnabled && biometricAvailable && (
                <Pressable
                  style={({ pressed }) => [s.secondaryBtn, (pressed || anyLoading) && { opacity: 0.7 }]}
                  onPress={handleBiometricLogin}
                  disabled={anyLoading}
                  android_ripple={{ color: Colors.accentMuted, borderless: false }}
                >
                  <Ionicons name="finger-print-outline" size={20} color={Colors.accent} />
                  <Text style={s.secondaryBtnText}>Login with Biometrics</Text>
                </Pressable>
              )}

              {/* ── Divider ── */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* ── Google Sign-In ── */}
              {googleEnabled ? (
                <Pressable
                  style={({ pressed }) => [s.oauthBtn, (pressed || anyLoading) && { opacity: 0.7 }]}
                  onPress={() => { setOauthLoading("google"); promptGoogleAsync(); }}
                  disabled={anyLoading}
                  android_ripple={{ color: Colors.border, borderless: false }}
                >
                  {oauthLoading === "google" ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <>
                      <Text style={s.googleG}>G</Text>
                      <Text style={s.oauthBtnText}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>
              ) : __DEV__ ? (
                <Pressable style={[s.oauthBtn, s.disabledBtn]} disabled android_ripple={{ color: Colors.border, borderless: false }}>
                  <Text style={s.googleG}>G</Text>
                  <View>
                    <Text style={s.oauthBtnText}>Continue with Google</Text>
                    <Text style={s.oauthSubText}>Configure .env to enable</Text>
                  </View>
                </Pressable>
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
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  kvFill: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    height: 260,
    overflow: "hidden",
  },
  heroInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.7,
    marginTop: 4,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeading: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 28,
  },

  // Labels
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },

  // Input wrapper
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
    backgroundColor: Colors.errorBg,
  },

  // Forgot row
  forgotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  rememberCheck: { flexDirection: "row", alignItems: "center", gap: 6 },
  rememberLabel:  { fontSize: 14, color: Colors.textSecondary },
  forgotText:     { fontSize: 13, color: Colors.accent, fontWeight: "600" },

  // Primary CTA
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnPressed: {
    backgroundColor: Colors.accentDark,
    opacity: 0.9,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: "700" },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: Colors.transparent,
  },
  secondaryBtnText: { color: Colors.accent, fontSize: 15, fontWeight: "600" },

  disabledBtn: { opacity: 0.45 },

  // Divider
  dividerRow:  { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 14, fontSize: 13, color: Colors.textMuted },

  // OAuth
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleG:      { fontSize: 17, fontWeight: "800", color: Colors.accent, width: 22, textAlign: "center" },
  oauthBtnText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  oauthSubText: { fontSize: 11, color: Colors.textMuted, textAlign: "center" },

  appleBtn: { width: "100%", height: 50, marginBottom: 12 },

  // Register
  registerRow:  { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerLink: { fontSize: 14, color: Colors.accent, fontWeight: "600" },
});
