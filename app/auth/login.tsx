// app/auth/login.tsx
import { SECURE_STORE_KEYS } from "@/constants/secureStoreKeys";
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
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
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
  const [_googleRequest, googleResponse, promptGoogleAsync] =
    Google.useAuthRequest({
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      scopes: ["profile", "email"],
    });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const token = googleResponse.authentication?.accessToken;
      if (token) handleOAuthLogin("google", () => loginWithGoogle(token));
    } else if (googleResponse?.type === "error") {
      setOauthLoading(null);
      Alert.alert(
        "Google Sign-In Failed",
        googleResponse.error?.message ?? "Try again.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  // ── Apple Sign-In (iOS only) ──────────────────────────────────
  const [_appleRequest, appleResponse, promptAppleAsync] =
    AppleAuthentication.useAuthRequest({
      clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_APPLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_APPLE_ANDROID_CLIENT_ID,
      scopes: ["email", "fullName"],
    });

  useEffect(() => {
    if (appleResponse?.type === "success") {
      const idToken = appleResponse.params?.id_token;
      const firstName = appleResponse.params?.given_name;
      const lastName = appleResponse.params?.family_name;
      const fullName =
        firstName || lastName
          ? `${firstName ?? ""} ${lastName ?? ""}`.trim()
          : undefined;
      if (idToken)
        handleOAuthLogin("apple", () => loginWithApple(idToken, fullName));
    } else if (appleResponse?.type === "error") {
      setOauthLoading(null);
      Alert.alert(
        "Apple Sign-In Failed",
        appleResponse.error?.message ?? "Try again.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appleResponse]);

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
      const message =
        error?.response?.data?.error ?? "Sign-in failed. Please try again.";
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
        const savedEmail = await AsyncStorage.getItem("@rememberedEmail");
        const savedPassword = await AsyncStorage.getItem("@rememberedPassword");
        const savedUseBiometrics = await AsyncStorage.getItem("@useBiometrics");

        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
        if (savedPassword) setPassword(savedPassword);
        setHasStoredCredentials(!!(savedEmail && savedPassword));
        if (savedUseBiometrics === "true") setBiometricEnabled(true);
      } catch {}
    })();
  }, []);

  // ── Check biometric hardware ──────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHardware && enrolled);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, [isNative]);

  // ── Email/password login ──────────────────────────────────────
  const handleLogin = async (
    overrideEmail?: string,
    overridePassword?: string,
  ) => {
    const loginEmail = overrideEmail ?? email;
    const loginPassword = overridePassword ?? password;

    const emailMissing = !loginEmail;
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
        await AsyncStorage.setItem("@rememberedEmail", loginEmail);
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
      const message =
        error?.response?.data?.error ?? "Invalid credentials or server error.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric login ───────────────────────────────────────────
  const handleBiometricLogin = async () => {
    if (!isNative) return;
    if (!biometricEnabled) {
      Alert.alert(
        "Biometric login not enabled",
        "Turn on biometric login in Settings first.",
      );
      return;
    }
    if (!biometricAvailable) {
      Alert.alert(
        "Biometrics not available",
        "This device does not support biometric authentication.",
      );
      return;
    }
    try {
      const savedEmail = await AsyncStorage.getItem("@rememberedEmail");
      const savedPassword = await AsyncStorage.getItem("@rememberedPassword");
      if (!savedEmail || !savedPassword) {
        setHasStoredCredentials(false);
        Alert.alert(
          "Biometric login not ready",
          "Please log in once with your email and password first.",
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login with biometrics",
        fallbackLabel:
          Platform.OS === "ios" ? "Use passcode" : "Use device PIN",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        await handleLogin(savedEmail, savedPassword);
      }
    } catch {
      Alert.alert(
        "Biometric error",
        "We couldn't complete biometric authentication.",
      );
    }
  };

  const anyLoading = loading || oauthLoading !== null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {isNative && (
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#ffffff"
          translucent={false}
          hidden={false}
        />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <TouchableWithoutFeedback
          onPress={Platform.OS !== "web" ? Keyboard.dismiss : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isNative && {
                paddingTop: isSmallScreen ? 24 : 40,
                paddingBottom:
                  (insets.bottom || 16) + (isSmallScreen ? 24 : 40),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={[styles.logo, isSmallScreen && styles.logoSmall]}
                resizeMode="contain"
              />

              <Text style={styles.heading}>Sign In to Your Account</Text>
              <Text style={styles.subtext}>
                Enter your email and password to continue
              </Text>

              {/* Email */}
              <Animatable.View
                ref={emailRef}
                animation={emailError ? "shake" : undefined}
              >
                <TextInput
                  style={[styles.input, emailError && styles.errorInput]}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (emailError && t) setEmailError(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                  returnKeyType="next"
                />
              </Animatable.View>

              {/* Password */}
              <Animatable.View
                ref={passwordRef}
                animation={passwordError ? "shake" : undefined}
                style={styles.passwordContainer}
              >
                <TextInput
                  style={[
                    styles.passwordInput,
                    passwordError && styles.errorInput,
                  ]}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry={hidePassword}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (passwordError && t) setPasswordError(false);
                  }}
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
                >
                  <Ionicons
                    name={hidePassword ? "eye-outline" : "eye"}
                    size={22}
                    color="#555"
                  />
                </Pressable>
              </Animatable.View>

              {/* Remember Me */}
              <View style={styles.rememberRow}>
                <Pressable onPress={() => setRememberMe((p) => !p)} hitSlop={8}>
                  <Ionicons
                    name={rememberMe ? "checkbox" : "square-outline"}
                    size={22}
                    color="#6a0dad"
                  />
                </Pressable>
                <Text style={styles.rememberLabel}>Remember Me</Text>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginBtn, anyLoading && styles.disabled]}
                onPress={() => handleLogin()}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* Biometric */}
              {isNative && biometricEnabled && biometricAvailable && (
                <TouchableOpacity
                  style={[styles.biometricBtn, anyLoading && styles.disabled]}
                  onPress={handleBiometricLogin}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#6a0dad" />
                  ) : (
                    <View style={styles.biometricBtnContent}>
                      <Ionicons
                        name="finger-print-outline"
                        size={20}
                        color="#6a0dad"
                      />
                      <Text style={styles.biometricBtnText}>
                        Login with Biometrics
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Forgot Password — visible to all */}
              <TouchableOpacity
                accessibilityLabel="Forgot your password?"
                onPress={() => router.push("/auth/forgot")}
                disabled={anyLoading}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* ── OAuth divider ─────────────────────────── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In */}
              <TouchableOpacity
                style={[styles.oauthBtn, anyLoading && styles.disabled]}
                onPress={() => {
                  setOauthLoading("google");
                  promptGoogleAsync();
                }}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {oauthLoading === "google" ? (
                  <ActivityIndicator color="#444" />
                ) : (
                  <View style={styles.oauthBtnContent}>
                    {/* Google "G" icon via Ionicons is unavailable — use text placeholder */}
                    <Text style={styles.oauthIcon}>G</Text>
                    <Text style={styles.oauthBtnText}>
                      Continue with Google
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Apple Sign-In — iOS only */}
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={[
                    styles.oauthBtn,
                    styles.appleBtn,
                    anyLoading && styles.disabled,
                  ]}
                  onPress={() => {
                    setOauthLoading("apple");
                    promptAppleAsync();
                  }}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                >
                  {oauthLoading === "apple" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.oauthBtnContent}>
                      <Ionicons name="logo-apple" size={20} color="#fff" />
                      <Text style={[styles.oauthBtnText, { color: "#fff" }]}>
                        Continue with Apple
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "center",
  },
  formContainer: { width: "100%", maxWidth: 420, alignSelf: "center" },
  logo: {
    width: 350,
    height: 200,
    borderRadius: 80,
    alignSelf: "center",
    marginBottom: 20,
  },
  logoSmall: { width: 260, height: 150, borderRadius: 60 },
  heading: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    color: "#0d1321",
  },
  subtext: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#f3f3f3",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  errorInput: { borderColor: "red", borderWidth: 1 },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f3f3",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 16 },
  rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  rememberLabel: { marginLeft: 8, color: "#333" },
  loginBtn: {
    backgroundColor: "#6a0dad",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  loginText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  biometricBtn: {
    borderWidth: 1,
    borderColor: "#6a0dad",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  biometricBtnContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  biometricBtnText: {
    color: "#6a0dad",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  forgotText: {
    fontSize: 14,
    color: "#6a0dad",
    textAlign: "center",
    marginBottom: 24,
  },
  disabled: { opacity: 0.6 },
  // ── OAuth ──────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: "#888" },
  oauthBtn: {
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  appleBtn: { backgroundColor: "#000", borderColor: "#000" },
  oauthBtnContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  oauthIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4285F4",
    width: 20,
    textAlign: "center",
  },
  oauthBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
});
