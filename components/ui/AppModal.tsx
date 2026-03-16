// components/ui/AppModal.tsx
// Cross-platform bottom-sheet style modal.
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { IS_IOS, SUPPORTS_LIQUID_GLASS } from '@/constants/Platform';
import { Typography } from '@/constants/Typography';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

export function AppModal({
  visible,
  onClose,
  title,
  children,
  contentStyle,
}: AppModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <BlurView
          intensity={SUPPORTS_LIQUID_GLASS ? 30 : 0}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        style={s.avoidView}
        pointerEvents="box-none"
      >
        <View style={[s.sheet, contentStyle]}>
          {/* Drag handle */}
          <View style={s.handle} />

          {title ? (
            <View style={s.titleRow}>
              <Text style={Typography.title3}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={[Typography.body, { color: Colors.accent }]}>Done</Text>
              </Pressable>
            </View>
          ) : null}

          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avoidView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    minHeight: 200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
});
