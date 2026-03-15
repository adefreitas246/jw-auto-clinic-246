// components/MoreMenu.tsx
// Reusable bottom-sheet overflow menu for role-based tab navigation.
// Used by CustomTabBar (staff/admin) and CustomerTabBar.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export type MoreMenuItem = {
  label:    string;
  icon:     string;
  route?:   string;
  onPress?: () => void;
  danger?:  boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items:   MoreMenuItem[];
};

export function MoreMenu({ visible, onClose, items }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={mm.backdrop} onPress={onClose}>
        {/* Tap inside sheet without closing */}
        <Pressable style={[mm.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={mm.handle} />
          <Text style={mm.title}>More</Text>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {items.map((item, i) => (
              <TouchableOpacity
                key={`${item.label}-${i}`}
                style={mm.row}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  if (item.onPress) {
                    item.onPress();
                  } else if (item.route) {
                    router.push(item.route as any);
                  }
                }}
              >
                <View style={[mm.iconWrap, item.danger && mm.iconWrapDanger]}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={item.danger ? Colors.error : Colors.accent}
                  />
                </View>
                <Text style={[mm.rowLabel, item.danger && mm.rowLabelDanger]}>
                  {item.label}
                </Text>
                {!item.danger && (
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const mm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '82%',
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '800', color: Colors.textPrimary,
    marginBottom: 12, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.surfaceAlt,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: Colors.errorBg },
  rowLabel:       { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowLabelDanger: { color: Colors.error },
});
