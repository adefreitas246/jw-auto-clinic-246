// app/(tabs)/ai/_layout.tsx
import { Stack } from 'expo-router';

export default function AILayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"    />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="insights" />
      <Stack.Screen name="pricing"  />
    </Stack>
  );
}
