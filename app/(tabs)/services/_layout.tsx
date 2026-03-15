// app/(tabs)/services/_layout.tsx
import { Stack } from 'expo-router';

export default function ServicesAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#6a0dad' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Manage Services' }} />
      <Stack.Screen name="add"   options={{ title: 'New Service',  presentation: 'modal' }} />
      <Stack.Screen name="[id]"  options={{ title: 'Edit Service', presentation: 'modal' }} />
    </Stack>
  );
}
