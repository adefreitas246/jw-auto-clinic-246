// index.tsx — root redirect based on auth state + role
import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth/login" />;
  if (user.role === 'customer') return <Redirect href="/(customer)/home" />;
  if (user.role === 'staff')    return <Redirect href="/(staff)/jobs" />;
  return <Redirect href="/(tabs)/home" />;
}
