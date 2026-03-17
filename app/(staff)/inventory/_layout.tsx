// app/(staff)/inventory/_layout.tsx
import { Stack } from 'expo-router';

export default function StaffInventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
