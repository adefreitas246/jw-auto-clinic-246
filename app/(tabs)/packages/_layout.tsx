// app/(tabs)/packages/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function PackagesAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.accent },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Manage Packages' }} />
      <Stack.Screen name="add"   options={{ title: 'New Package',  presentation: 'modal' }} />
      <Stack.Screen name="[id]"  options={{ title: 'Edit Package', presentation: 'modal' }} />
    </Stack>
  );
}
