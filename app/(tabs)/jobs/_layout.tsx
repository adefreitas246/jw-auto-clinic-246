// app/(tabs)/jobs/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:     false,
        animation:       'slide_from_right',
        contentStyle:    { backgroundColor: Colors.surfaceAlt },
      }}
    />
  );
}
