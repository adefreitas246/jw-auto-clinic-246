// app/(customer)/book/_layout.tsx
// Provides BookingContext to all booking screens and a Stack navigator.
import { BookingProvider } from '@/context/BookingContext';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius } from '@/utils/platformStyles';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const STEPS = ['Vehicle', 'Services', 'Date & Time', 'Location', 'Review', 'Payment', 'Done'];

export function BookingProgressBar({ step }: { step: number }) {
  // step is 1-indexed
  const totalSteps = STEPS.length;

  return (
    <View style={pb.container}>
      {/* Step dots row */}
      <View style={pb.dotsRow}>
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < step;
          const isCurrent   = stepNum === step;
          return (
            <View key={label} style={pb.dotItem}>
              <View
                style={[
                  pb.dot,
                  isCompleted && pb.dotCompleted,
                  isCurrent   && pb.dotCurrent,
                ]}
              >
                {isCompleted ? (
                  <Text style={pb.dotCheckmark}>✓</Text>
                ) : (
                  <Text style={[pb.dotNum, isCurrent && pb.dotNumCurrent]}>
                    {stepNum}
                  </Text>
                )}
              </View>
              {i < totalSteps - 1 && (
                <View style={[pb.connector, isCompleted && pb.connectorDone]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Current step label */}
      <Text style={pb.stepLabel}>
        Step {step} of {totalSteps}  ·  <Text style={pb.stepName}>{STEPS[step - 1]}</Text>
      </Text>
    </View>
  );
}

const pb = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  dotCompleted: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  dotNum: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dotNumCurrent: {
    color: Colors.accent,
  },
  dotCheckmark: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 2,
  },
  connectorDone: {
    backgroundColor: Colors.accent,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  stepName: {
    fontWeight: '700',
    color: Colors.accent,
  },
});

export default function BookLayout() {
  return (
    <BookingProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.accent,
          headerTitleStyle: { fontWeight: '700', color: Colors.textPrimary },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.surfaceAlt },
          ...(IS_IOS ? {} : { animation: 'slide_from_right' }),
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
