// app/(customer)/booking/_layout.tsx
import { Stack } from 'expo-router';

export default function BookingDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
