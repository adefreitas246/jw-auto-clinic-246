// components/ui/BottomSheet.tsx
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { IS_IOS, SUPPORTS_LIQUID_GLASS } from '@/utils/platform';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  snapPoint?: number | string;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  contentStyle,
  snapPoint,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 28,
          stiffness: 250,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Scrim */}
      <Animated.View style={[s.scrim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {SUPPORTS_LIQUID_GLASS && (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        )}
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        style={s.avoidView}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 16 },
            snapPoint && { maxHeight: snapPoint },
            { transform: [{ translateY }] },
            contentStyle,
          ]}
        >
          {SUPPORTS_LIQUID_GLASS && (
            <BlurView intensity={80} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} />
          )}

          {/* Drag handle */}
          <View style={s.handle} />

          {title && (
            <View style={s.titleRow}>
              <Text style={s.titleText}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={s.doneText}>Done</Text>
              </Pressable>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  avoidView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: IS_IOS ? 'rgba(255,255,255,0.95)' : Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    overflow: 'hidden',
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
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accent,
  },
});
