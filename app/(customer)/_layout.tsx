// app/(customer)/_layout.tsx
import { CustomerTabBar } from '@/components/CustomerTabBar';
import { useAuth } from '@/context/AuthContext';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TransparentHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height: insets.top, backgroundColor: 'transparent' }}>
      <StatusBar style="dark" translucent />
    </View>
  );
}

export default function CustomerLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  if (!user || user.role !== 'customer') {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomerTabBar {...props} />}
      screenOptions={{
        headerShown: Platform.OS !== 'web',
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTitle: '',
        header: () => <TransparentHeader />,
      }}
    >
      <Tabs.Screen name="home"     />
      <Tabs.Screen name="catalog"  />
      <Tabs.Screen name="vehicles" />
      {/* Booking wizard — routable but not a tab bar item */}
      <Tabs.Screen name="book"    options={{ href: null }} />
      {/* Live job tracking — routable but not a tab bar item */}
      <Tabs.Screen name="track"   options={{ href: null }} />
      {/* Booking detail + QR — routable but not a tab bar item */}
      <Tabs.Screen name="booking"       options={{ href: null }} />
      {/* Loyalty rewards */}
      <Tabs.Screen name="loyalty"       options={{ href: null }} />
      {/* Subscription plans */}
      <Tabs.Screen name="subscriptions" options={{ href: null }} />
      {/* Rate / review screen (deep-linked from push) */}
      <Tabs.Screen name="rate"          options={{ href: null }} />
      {/* Referral code + share */}
      <Tabs.Screen name="referral"      options={{ href: null }} />
    </Tabs>
  );
}
