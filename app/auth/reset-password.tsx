// reset-password.tsx
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const API =
  process.env.EXPO_PUBLIC_API_URL || 'https://jw-auto-clinic-246.onrender.com';

export default function ResetPasswordScreen() {
  const rawParams = useLocalSearchParams();
  const token = Array.isArray(rawParams.token)
    ? rawParams.token[0]
    : typeof rawParams.token === 'string'
      ? rawParams.token
      : '';

  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const passwordRef = useRef<Animatable.View>(null);
  const confirmRef = useRef<Animatable.View>(null);

  const [passwordStrength, setPasswordStrength] = useState<
    'Weak' | 'Medium' | 'Strong' | null
  >(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMatch, setConfirmMatch] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      alert('Invalid Link, Reset token is missing.');
      router.replace('/auth/forgot');
    }
  }, [token]);

  useEffect(() => {
    if (confirm.length > 0) {
      setConfirmMatch(confirm === password);
    } else {
      setConfirmMatch(null);
    }
  }, [password, confirm]);

  const triggerHaptic = () => {
    if (IS_IOS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const getPasswordStrength = (
    pwd: string
  ): 'Weak' | 'Medium' | 'Strong' | null => {
    if (!pwd) return null;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[@$!%*?&()[\]{}^#_+=-]/.test(pwd);
    const isLong = pwd.length >= 8;

    const score = [hasUpper, hasLower, hasNumber, hasSpecial, isLong].filter(
      Boolean
    ).length;

    if (score <= 2) return 'Weak';
    if (score === 3 || score === 4) return 'Medium';
    return 'Strong';
  };

  useEffect(() => {
    setPasswordStrength(getPasswordStrength(password));
  }, [password]);

  const strengthMeta = useMemo(() => {
    switch (passwordStrength) {
      case 'Weak':
        return { color: Colors.error, bgColor: Colors.errorBg, width: '33%' as const };
      case 'Medium':
        return { color: Colors.warning, bgColor: Colors.warningBg, width: '66%' as const };
      case 'Strong':
        return { color: Colors.success, bgColor: Colors.successBg, width: '100%' as const };
      default:
        return { color: Colors.border, bgColor: Colors.surfaceAlt, width: '0%' as const };
    }
  }, [passwordStrength]);

  const handleReset = async () => {
    let hasError = false;
    setPasswordError(false);
    setConfirmError(false);

    if (!password) {
      passwordRef.current?.shake?.(600);
      setPasswordError(true);
      hasError = true;
    }

    if (!confirm) {
      confirmRef.current?.shake?.(600);
      setConfirmError(true);
      hasError = true;
    }

    if (hasError) {
      triggerHaptic();
      alert('Missing Fields, Both password fields are required.');
      return;
    }

    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}^#_+=-])[A-Za-z\d@$!%*?&()[\]{}^#_+=-]{8,}$/;
    if (!strongRegex.test(password)) {
      passwordRef.current?.shake?.(600);
      setPasswordError(true);
      triggerHaptic();
      alert(
        'Weak Password, Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      );
      return;
    }

    if (password !== confirm) {
      confirmRef.current?.shake?.(600);
      setConfirmError(true);
      triggerHaptic();
      return;
    }

    setConfirmMatch(true);

    try {
      setLoading(true);
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        if (IS_IOS) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowSuccess(true);
        setTimeout(() => {
          router.replace('/auth/login');
        }, 2000);
      } else {
        alert(data?.error || 'Reset failed.');
      }
    } catch (err) {
      alert('Error, Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={IS_IOS ? 'padding' : 'height'}
        keyboardVerticalOffset={IS_IOS ? 0 : 20}
      >
        <TouchableWithoutFeedback
          onPress={Platform.OS !== 'web' ? Keyboard.dismiss : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeIn.duration(300)} style={s.container}>
              {showSuccess ? (
                <Animatable.View
                  animation="zoomIn"
                  duration={700}
                  style={s.successBox}
                >
                  <Image
                    source={require('@/assets/images/success.png')}
                    style={s.illustration}
                  />
                  <View style={s.successBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={s.successText}>Password Reset Successfully</Text>
                  </View>
                  <Text style={s.successSub}>Redirecting you to login…</Text>
                </Animatable.View>
              ) : (
                <>
                  <Image
                    source={require('@/assets/images/reset-password-illustration.png')}
                    style={s.illustration}
                  />

                  <Text style={s.heading}>Reset Your Password</Text>
                  <Text style={s.subtext}>
                    Choose a strong password with uppercase, lowercase, a number, and a special character.
                  </Text>

                  {/* New password field */}
                  <Text style={s.label}>New Password</Text>
                  <Animatable.View ref={passwordRef}>
                    <View style={[s.inputWrapper, passwordError && s.inputWrapperError]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={passwordError ? Colors.error : Colors.textMuted}
                        style={s.inputIcon}
                      />
                      <TextInput
                        placeholder="New Password"
                        placeholderTextColor={Colors.textMuted}
                        secureTextEntry={!showPassword}
                        style={s.input}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <Pressable
                        onPress={() => setShowPassword((p) => !p)}
                        style={s.eyeBtn}
                        accessibilityLabel="Toggle password visibility"
                        hitSlop={8}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={Colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  </Animatable.View>

                  {/* Strength meter */}
                  {passwordStrength && (
                    <View style={s.meterContainer}>
                      <View style={s.meterTrack}>
                        <View
                          style={[
                            s.meterFill,
                            {
                              width: strengthMeta.width,
                              backgroundColor: strengthMeta.color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[s.meterLabel, { color: strengthMeta.color }]}>
                        {passwordStrength} Password
                      </Text>
                    </View>
                  )}

                  <Text style={s.hintText}>
                    Min 8 characters · uppercase · lowercase · number · special character
                  </Text>

                  {/* Confirm password field */}
                  <Text style={[s.label, { marginTop: 16 }]}>Confirm Password</Text>
                  <Animatable.View ref={confirmRef}>
                    <View
                      style={[
                        s.inputWrapper,
                        confirmError && s.inputWrapperError,
                        confirmMatch === false && s.inputWrapperError,
                        confirmMatch === true && s.inputWrapperSuccess,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={
                          confirmMatch === true
                            ? Colors.success
                            : confirmMatch === false
                            ? Colors.error
                            : Colors.textMuted
                        }
                        style={s.inputIcon}
                      />
                      <TextInput
                        placeholder="Confirm New Password"
                        placeholderTextColor={Colors.textMuted}
                        secureTextEntry={!showConfirm}
                        style={s.input}
                        value={confirm}
                        onChangeText={(text) => {
                          setConfirm(text);
                          if (text.length > 0) {
                            setConfirmMatch(text === password);
                          } else {
                            setConfirmMatch(null);
                          }
                        }}
                      />
                      <Pressable
                        onPress={() => setShowConfirm((p) => !p)}
                        style={s.eyeBtn}
                        accessibilityLabel="Toggle confirm password visibility"
                        hitSlop={8}
                      >
                        <Ionicons
                          name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={Colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  </Animatable.View>

                  {confirmMatch === false && (
                    <Text style={s.mismatchText}>Passwords do not match</Text>
                  )}
                  {confirmMatch === true && (
                    <Text style={s.matchText}>Passwords match</Text>
                  )}

                  {/* Submit button */}
                  <Pressable
                    style={({ pressed }) => [
                      s.primaryBtn,
                      (pressed || loading) && s.primaryBtnPressed,
                    ]}
                    onPress={handleReset}
                    disabled={loading}
                    android_ripple={{ color: Colors.accentDark, borderless: false }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={s.primaryBtnText}>Reset Password</Text>
                    )}
                  </Pressable>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  container: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 24,
  },

  illustration: {
    width: 260,
    height: 260,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  inputWrapperError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  inputWrapperSuccess: {
    borderColor: Colors.success,
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    padding: 4,
  },

  meterContainer: {
    marginBottom: 4,
  },
  meterTrack: {
    height: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  meterFill: {
    height: 5,
    borderRadius: 3,
  },
  meterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  hintText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },

  mismatchText: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 8,
    marginLeft: 4,
  },
  matchText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },

  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
    ...cardShadow,
  },
  primaryBtnPressed: {
    opacity: 0.85,
    backgroundColor: Colors.accentDark,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  successBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: borderRadius.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  successText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.successText,
  },
  successSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
  },
});
