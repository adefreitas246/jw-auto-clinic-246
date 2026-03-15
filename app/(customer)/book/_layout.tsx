// app/(customer)/book/_layout.tsx
// Provides BookingContext to all booking screens and a Stack navigator.
import { BookingProvider } from '@/context/BookingContext';
import { Stack } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

const STEPS = ['Vehicle', 'Services', 'Date & Time', 'Location', 'Review', 'Payment', 'Done'];

export function BookingProgressBar({ step }: { step: number }) {
  // step is 1-indexed
  const pct = ((step - 1) / (STEPS.length - 1)) * 100;
  return (
    <View style={pb.container}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={pb.label}>{STEPS[step - 1]}  ·  {step}/{STEPS.length}</Text>
    </View>
  );
}

const pb = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 8 },
  track:     { height: 3, backgroundColor: '#ede0f7', borderRadius: 99, overflow: 'hidden' },
  fill:      { height: 3, backgroundColor: '#6a0dad', borderRadius: 99 },
  label:     { fontSize: 11, color: '#888', marginTop: 5 },
});

export default function BookLayout() {
  return (
    <BookingProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#6a0dad',
          headerTitleStyle: { fontWeight: '700', color: '#1f1f1f' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#f7f7fb' },
          ...Platform.select({ ios: {}, android: { animation: 'slide_from_right' } }),
        }}
      >
        <Stack.Screen name="index"     options={{ title: 'Select Vehicle' }} />
        <Stack.Screen name="services"  options={{ title: 'Choose Services' }} />
        <Stack.Screen name="datetime"  options={{ title: 'Pick a Date & Time' }} />
        <Stack.Screen name="location"  options={{ title: 'Choose Location' }} />
        <Stack.Screen name="review"    options={{ title: 'Review Booking' }} />
        <Stack.Screen name="payment"   options={{ title: 'Payment', headerShown: false }} />
        <Stack.Screen name="confirmed" options={{ title: 'Booking Confirmed', headerShown: false }} />
      </Stack>
    </BookingProvider>
  );
}
