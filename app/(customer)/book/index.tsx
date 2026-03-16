// app/(customer)/book/index.tsx — Step 1: Select Vehicle
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import VehiclePicker from '@/components/VehiclePicker';
import { Vehicle } from '@/types/vehicle';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

export default function BookVehicleStep() {
  const { draft, setVehicle } = useBooking();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelect = (v: Vehicle | null) => {
    setVehicle(v);
    setPickerOpen(false);
  };

  const canContinue = true; // vehicle is optional

  const openPicker = () => {
    Haptics.selectionAsync();
    setPickerOpen(true);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={1} />

      <View style={s.container}>
        <Text style={s.heading}>Which vehicle are we washing?</Text>
        <Text style={s.sub}>Select a saved vehicle or skip to continue without one.</Text>

        {/* Vehicle selector card */}
        <Pressable
          style={({ pressed }) => [s.vehicleCard, pressed && { opacity: 0.9 }]}
          onPress={openPicker}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          {draft.vehicle ? (
            <>
              <View style={s.vehicleIconWrap}>
                <Ionicons name="car-sport" size={26} color={Colors.accent} />
              </View>
              <View style={s.vehicleBody}>
                <Text style={s.vehicleName}>
                  {draft.vehicle.make} {draft.vehicle.model}
                </Text>
                <View style={s.vehicleMetaRow}>
                  {!!draft.vehicle.size && (
                    <View style={s.vehicleSizeTag}>
                      <Text style={s.vehicleSizeTagText}>{draft.vehicle.size}</Text>
                    </View>
                  )}
                  {!!draft.vehicle.licensePlate && (
                    <View style={s.vehiclePlateBadge}>
                      <Text style={s.vehiclePlateBadgeText}>{draft.vehicle.licensePlate}</Text>
                    </View>
                  )}
                  {!!draft.vehicle.color && (
                    <Text style={s.vehicleColorText}>{draft.vehicle.color}</Text>
                  )}
                </View>
              </View>
              <View style={s.selectedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
              </View>
            </>
          ) : (
            <>
              <View style={[s.vehicleIconWrap, s.vehicleIconEmpty]}>
                <Ionicons name="car-outline" size={26} color={Colors.textMuted} />
              </View>
              <View style={s.vehicleBody}>
                <Text style={s.vehicleNameEmpty}>No vehicle selected</Text>
                <Text style={s.vehicleMetaEmpty}>Tap to choose a saved vehicle</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.border} />
            </>
          )}
        </Pressable>

        {draft.vehicle && (
          <Pressable
            style={s.clearBtn}
            onPress={() => setVehicle(null)}
            android_ripple={{ color: Colors.accent + '12', borderless: false }}
          >
            <Ionicons name="close-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={s.clearText}>Continue without a vehicle</Text>
          </Pressable>
        )}

        {/* Info note */}
        <View style={s.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
          <Text style={s.infoNoteText}>
            Adding a vehicle helps us apply the right pricing and services.
          </Text>
        </View>
      </View>

      <VehiclePicker
        visible={pickerOpen}
        selected={draft.vehicle}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [
            s.nextBtn,
            !canContinue && s.nextBtnDisabled,
            pressed && canContinue && { opacity: 0.88 },
          ]}
          onPress={() => router.push('/(customer)/book/services')}
          disabled={!canContinue}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          <Text style={s.nextBtnText}>Next — Choose Services</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.surfaceAlt },
  container: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: 24 },
  heading:   { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  sub:       { fontSize: 14, color: Colors.textMuted, marginBottom: 24, lineHeight: 20 },

  // Vehicle card
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.accent,
    ...cardShadow,
    marginBottom: 12,
  },
  vehicleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIconEmpty: {
    backgroundColor: Colors.background,
  },
  vehicleBody: { flex: 1 },
  vehicleName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  vehicleNameEmpty: { fontSize: 15, fontWeight: '600', color: Colors.textMuted, marginBottom: 2 },
  vehicleMetaEmpty: { fontSize: 13, color: Colors.textMuted },
  vehicleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  vehicleSizeTag: {
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vehicleSizeTagText: { fontSize: 11, fontWeight: '600', color: Colors.accent },
  vehiclePlateBadge: {
    backgroundColor: Colors.chrome,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  vehiclePlateBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1.2 },
  vehicleColorText: { fontSize: 12, color: Colors.textSecondary },
  selectedBadge: { marginLeft: 8 },

  // Clear button
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  clearText: { fontSize: 13, color: Colors.textMuted },

  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.infoBg,
    borderRadius: borderRadius.md,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoNoteText: { flex: 1, fontSize: 13, color: Colors.infoText, lineHeight: 18 },

  // Footer
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: IS_IOS ? 32 : 20,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  nextBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
