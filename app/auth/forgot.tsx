import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback
} from 'react-native';
import * as Animatable from 'react-native-animatable';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth(); // assume you have or will define this

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [sending, setSending] = useState(false);

  const emailRef = useRef(null);

  const handleReset = async () => {
    setEmailError(!email);
  
    if (!email) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
  
    try {
      setSending(true);
      await forgotPassword(email);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert('Success', 'Password reset link sent to your email.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };  

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.heading}>Forgot Your Password?</Text>
          <Text style={styles.subtext}>
            Enter your email and we’ll send you a link to reset it.
          </Text>

          <Animatable.View
            ref={emailRef}
            animation={emailError ? 'shake' : undefined}
          >
            <TextInput
              placeholder="Email Address"
              placeholderTextColor="#888"
              style={[styles.input, emailError && styles.errorInput]}
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
          </Animatable.View>

          <TouchableOpacity
            style={[styles.loginBtn, sending && { opacity: 0.7 }]}
            onPress={handleReset}
            disabled={sending}
          >
            <Text style={styles.loginText}>
              {sending ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={styles.forgotText}>
              <Ionicons name="arrow-back" size={16} /> Back to Login
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    color: '#0d1321',
  },
  subtext: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#f3f3f3',
    padding: 14,
    borderRadius: 10,
    marginBottom: 24,
    fontSize: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  errorInput: {
    borderColor: 'red',
    borderWidth: 1,
  },
  loginBtn: {
    backgroundColor: '#6a0dad',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 14,
    color: '#6a0dad',
    textAlign: 'center',
  },
});
