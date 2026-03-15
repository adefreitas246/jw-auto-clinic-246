// app/(tabs)/marketing/_layout.tsx
import { Stack } from 'expo-router';

export default function MarketingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="campaigns" />
      <Stack.Screen name="coupons" />
      <Stack.Screen name="sms" />
    </Stack>
  );
}
