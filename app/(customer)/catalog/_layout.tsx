// app/(customer)/catalog/_layout.tsx
import { Stack } from 'expo-router';

export default function CatalogLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#6a0dad' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Services & Packages' }} />
    </Stack>
  );
}
