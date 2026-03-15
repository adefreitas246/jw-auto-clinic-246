// app/(customer)/catalog/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function CatalogLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.accent },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Services & Packages' }} />
    </Stack>
  );
}
