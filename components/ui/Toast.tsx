// components/ui/Toast.tsx
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastRef {
  show: (message: string, type?: ToastType, duration?: number) => void;
}

const TYPE_COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: Colors.success,  text: Colors.white },
  error:   { bg: Colors.error,    text: Colors.white },
  info:    { bg: Colors.accent,   text: Colors.white },
  warning: { bg: Colors.warning,  text: Colors.white },
};

let globalRef: ToastRef | null = null;

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  globalRef?.show(message, type, duration);
}

export function ToastProvider() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const anims = useRef<Map<string, Animated.Value>>(new Map());

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString();
    const anim = new Animated.Value(0);
    anims.current.set(id, anim);
    setToasts(prev => [...prev, { id, message, type }]);

    if (IS_IOS) {
      const hapticMap = {
        success: Haptics.NotificationFeedbackType.Success,
        error:   Haptics.NotificationFeedbackType.Error,
        warning: Haptics.NotificationFeedbackType.Warning,
        info:    Haptics.NotificationFeedbackType.Success,
      };
      Haptics.notificationAsync(hapticMap[type]);
    }

    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 300 }),
      Animated.delay(duration),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      anims.current.delete(id);
    });
  }, []);

  useEffect(() => {
    globalRef = { show };
    return () => { globalRef = null; };
  }, [show]);

  const positionStyle = IS_IOS
    ? { top: insets.top + 12 }
    : { bottom: insets.bottom + 20 };

  return (
    <View style={[s.container, positionStyle]} pointerEvents="none">
      {toasts.map(toast => {
        const anim = anims.current.get(toast.id) ?? new Animated.Value(1);
        const { bg, text } = TYPE_COLORS[toast.type];
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: IS_IOS ? [-20, 0] : [20, 0],
        });
        return (
          <Animated.View
            key={toast.id}
            style={[
              s.toast,
              { backgroundColor: bg, opacity: anim, transform: [{ translateY }] },
            ]}
          >
            <Text style={[s.text, { color: text }]}>{toast.message}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: IS_IOS ? 999 : 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 360,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
