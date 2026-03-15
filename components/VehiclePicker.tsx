// components/VehiclePicker.tsx
// Reusable bottom-sheet component for selecting (or clearing) a customer vehicle.
// Usage:
//   const [pickerOpen, setPickerOpen] = useState(false);
//   const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
//
//   <VehiclePicker
//     visible={pickerOpen}
//     selected={selectedVehicle}
//     onSelect={(v) => { setSelectedVehicle(v); setPickerOpen(false); }}
//     onClose={() => setPickerOpen(false)}
//   />
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useVehicles } from '@/hooks/useVehicles';
import { Vehicle } from '@/types/vehicle';
import { Colors } from '@/constants/Colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;

interface VehiclePickerProps {
  visible: boolean;
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle | null) => void;
  onClose: () => void;
}

export default function VehiclePicker({
  visible,
  selected,
  onSelect,
  onClose,
}: VehiclePickerProps) {
  const { vehicles, loading, refresh } = useVehicles();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      refresh();
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={s.backdrop} onPress={onClose} />

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Select Vehicle</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
          {/* None option */}
          <Pressable
            style={[s.row, !selected && s.rowActive]}
            onPress={() => onSelect(null)}
          >
            <View style={s.iconWrap}>
              <Ionicons
                name="remove-circle-outline"
                size={22}
                color={!selected ? Colors.accent : Colors.textMuted}
              />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, !selected && s.rowTitleActive]}>No vehicle</Text>
            </View>
            {!selected && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            )}
          </Pressable>

          {loading && vehicles.length === 0 ? (
            <Text style={s.hint}>Loading…</Text>
          ) : vehicles.length === 0 ? (
            <Text style={s.hint}>No vehicles saved yet.</Text>
          ) : (
            vehicles.map((v: Vehicle) => {
              const isActive = selected?._id === v._id;
              return (
                <Pressable
                  key={v._id}
                  style={[s.row, isActive && s.rowActive]}
                  onPress={() => onSelect(v)}
                >
                  <View style={s.iconWrap}>
                    <Ionicons
                      name="car-outline"
                      size={22}
                      color={isActive ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                  <View style={s.rowBody}>
                    <Text style={[s.rowTitle, isActive && s.rowTitleActive]}>
                      {v.make} {v.model}
                    </Text>
                    <Text style={s.rowSub}>
                      {[v.size, v.color, v.licensePlate].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                  )}
                </Pressable>
              );
            })
          )}

          {/* Add new shortcut */}
          <Pressable
            style={s.addRow}
            onPress={() => {
              onClose();
              router.push('/(customer)/vehicles/add');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
            <Text style={s.addText}>Add a new vehicle</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
  },
  rowActive: { backgroundColor: Colors.accentMuted },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody:       { flex: 1 },
  rowTitle:      { fontSize: 15, color: Colors.textPrimary },
  rowTitleActive:{ fontWeight: '600', color: Colors.accent },
  rowSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  hint: { textAlign: 'center', color: Colors.textMuted, marginTop: 20, fontSize: 14 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  addText: { fontSize: 15, color: Colors.accent, fontWeight: '600' },
});
