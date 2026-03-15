// app/(customer)/vehicles/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function VehiclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.accent },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Vehicles' }} />
      <Stack.Screen name="add"   options={{ title: 'Add Vehicle', presentation: 'modal' }} />
      <Stack.Screen name="[id]"  options={{ title: 'Edit Vehicle', presentation: 'modal' }} />
    </Stack>
  );
}
