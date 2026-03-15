// app/(tabs)/packages/_layout.tsx
import { Stack } from 'expo-router';

export default function PackagesAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#6a0dad' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Manage Packages' }} />
      <Stack.Screen name="add"   options={{ title: 'New Package',  presentation: 'modal' }} />
      <Stack.Screen name="[id]"  options={{ title: 'Edit Package', presentation: 'modal' }} />
    </Stack>
  );
}
