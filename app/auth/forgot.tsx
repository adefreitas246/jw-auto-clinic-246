// forgot.tsx
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [sending, setSending] = useState(false);

  const emailRef = useRef<TextInput>(null);

  const handleReset = async () => {
    setEmailError(!email);

    if (!email) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    try {
      setSending(true);
      if (IS_IOS) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (forgotPassword) {
        await forgotPassword(email);
      } else {
        const res = await fetch(
          'https://jw-auto-clinic-246.onrender.com/api/auth/forgot-password',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Request failed');
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert('Success', 'Password reset link sent to your email.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  const handleBackToLogin = () => {
    if (Platform.OS === 'web') {
      router.replace('/auth/login');
    } else {
      router.back();
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
              {/* Illustration */}
              <Image
                source={require('@/assets/images/forgot-illustration.png')}
                style={s.illustration}
              />

              {/* Heading */}
              <Text style={s.heading}>Forgot Your Password?</Text>
              <Text style={s.subtext}>
                Enter your email and we'll send you a link to reset it.
              </Text>

              {/* Email input */}
              <View style={s.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailError ? Colors.error : Colors.textMuted}
                  style={s.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  placeholder="Email Address"
                  placeholderTextColor={Colors.textMuted}
                  style={[s.input, emailError && s.inputError]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError(false);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
              </View>

              {emailError && (
                <Text style={s.errorText}>Please enter a valid email address.</Text>
              )}

              {/* Send button */}
              <Pressable
                style={({ pressed }) => [
                  s.primaryBtn,
                  (pressed || sending) && s.primaryBtnPressed,
                ]}
                onPress={handleReset}
                disabled={sending}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={s.primaryBtnText}>Send Reset Link</Text>
                )}
              </Pressable>

              {/* Back to login */}
              <Pressable
                onPress={handleBackToLogin}
                style={({ pressed }) => [
                  s.backButton,
                  pressed && { backgroundColor: Colors.accentMuted },
                ]}
                android_ripple={{ color: Colors.accentMuted, borderless: false }}
              >
                <Ionicons name="arrow-back" size={16} color={Colors.accent} />
                <Text style={s.backButtonText}>Back to Login</Text>
              </Pressable>
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
    justifyContent: 'center',
  },

  illustration: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    paddingHorizontal: 12,
    ...cardShadow,
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
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 16,
    marginLeft: 4,
  },

  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 12,
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

  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderColor: Colors.accent,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: Colors.accent,
    marginLeft: 6,
    fontWeight: '600',
  },
});
