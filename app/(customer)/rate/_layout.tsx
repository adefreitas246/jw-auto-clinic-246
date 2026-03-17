// app/(customer)/rate/_layout.tsx
import { Stack } from 'expo-router';

export default function RateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
