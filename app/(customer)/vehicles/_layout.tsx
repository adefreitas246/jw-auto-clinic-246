// app/(customer)/vehicles/_layout.tsx
import { Stack } from 'expo-router';

export default function VehiclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#6a0dad' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Vehicles' }} />
      <Stack.Screen name="add"   options={{ title: 'Add Vehicle', presentation: 'modal' }} />
      <Stack.Screen name="[id]"  options={{ title: 'Edit Vehicle', presentation: 'modal' }} />
    </Stack>
  );
}
