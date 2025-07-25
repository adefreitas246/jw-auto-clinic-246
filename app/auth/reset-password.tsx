import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.29:5000';

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

  useEffect(() => {
    if (!token) {
      alert('Invalid Link, Reset token is missing.');
      router.replace('/auth/forgot');
    }
  }, [token]);

  const handleReset = async () => {
    if (!password || !confirm) {
      alert('Error, Both password fields are required.');
      return;
    }
    if (password !== confirm) {
      alert('Error ,Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      alert('Error, Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success, Password reset successful.');
        router.replace('/auth/login');
      } else {
        Alert.alert('Error', data?.error || 'Reset failed.');
      }
    } catch (err) {
      alert('Error, Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Reset Your Password</Text>

      <TextInput
        placeholder="New Password"
        placeholderTextColor="#999"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm New Password"
        placeholderTextColor="#999"
        secureTextEntry
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleReset}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 20, color: '#0d1321', textAlign: 'center' },
  input: {
    backgroundColor: '#f3f3f3',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6a0dad',
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});
