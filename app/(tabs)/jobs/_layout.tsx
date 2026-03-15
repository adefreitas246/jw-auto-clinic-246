// app/(tabs)/jobs/_layout.tsx
import { Stack } from 'expo-router';

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:     false,
        animation:       'slide_from_right',
        contentStyle:    { backgroundColor: '#f7f7fb' },
      }}
    />
  );
}
