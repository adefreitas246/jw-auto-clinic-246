// app/(customer)/book/index.tsx — Step 1: Select Vehicle
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { useBooking } from '@/context/BookingContext';
import VehiclePicker from '@/components/VehiclePicker';
import { Vehicle } from '@/types/vehicle';

export default function BookVehicleStep() {
  const { draft, setVehicle } = useBooking();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelect = (v: Vehicle | null) => {
    setVehicle(v);
    setPickerOpen(false);
  };

  const canContinue = true; // vehicle is optional

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={1} />

      <View style={s.container}>
        <Text style={s.heading}>Which vehicle are we washing?</Text>
        <Text style={s.sub}>Select a saved vehicle or skip to continue without one.</Text>

        {/* Selected vehicle card / placeholder */}
        <Pressable style={s.vehicleCard} onPress={() => setPickerOpen(true)}>
          {draft.vehicle ? (
            <>
              <View style={s.vehicleIcon}>
                <Ionicons name="car" size={28} color="#6a0dad" />
              </View>
              <View style={s.vehicleBody}>
                <Text style={s.vehicleName}>
                  {draft.vehicle.make} {draft.vehicle.model}
                </Text>
                <Text style={s.vehicleMeta}>
                  {[draft.vehicle.size, draft.vehicle.color, draft.vehicle.licensePlate]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </>
          ) : (
            <>
              <View style={[s.vehicleIcon, { backgroundColor: '#f0f0f0' }]}>
                <Ionicons name="car-outline" size={28} color="#aaa" />
              </View>
              <View style={s.vehicleBody}>
                <Text style={s.vehicleNameMuted}>No vehicle selected</Text>
                <Text style={s.vehicleMeta}>Tap to choose a saved vehicle</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </>
          )}
        </Pressable>

        {draft.vehicle && (
          <Pressable style={s.clearBtn} onPress={() => setVehicle(null)}>
            <Ionicons name="close-circle-outline" size={16} color="#888" />
            <Text style={s.clearText}>Continue without a vehicle</Text>
          </Pressable>
        )}
      </View>

      <VehiclePicker
        visible={pickerOpen}
        selected={draft.vehicle}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />

      <View style={s.footer}>
        <Pressable
          style={[s.nextBtn, !canContinue && s.nextBtnDisabled]}
          onPress={() => router.push('/(customer)/book/services')}
          disabled={!canContinue}
        >
          <Text style={s.nextBtnText}>Next — Choose Services</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#f7f7fb' },
  container: { flex: 1, padding: 20 },
  heading:   { fontSize: 20, fontWeight: '800', color: '#1f1f1f', marginBottom: 6 },
  sub:       { fontSize: 14, color: '#888', marginBottom: 24 },

  vehicleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 2, borderColor: '#6a0dad',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },
  vehicleIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#f3eafd', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  vehicleBody: { flex: 1 },
  vehicleName: { fontSize: 15, fontWeight: '700', color: '#1f1f1f' },
  vehicleNameMuted: { fontSize: 15, fontWeight: '600', color: '#aaa' },
  vehicleMeta:     { fontSize: 12, color: '#888', marginTop: 2 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  clearText: { fontSize: 13, color: '#888' },

  footer:          { padding: 20, paddingBottom: 32 },
  nextBtn:         { backgroundColor: '#6a0dad', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
