// components/ui/Input.tsx
import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { IS_ANDROID } from '@/utils/platform';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const labelAnim = useRef(
    new Animated.Value(rest.value ? 1 : 0)
  ).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(labelAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
    rest.onFocus?.({} as any);
  };

  const onBlur = () => {
    setFocused(false);
    if (!rest.value) {
      Animated.timing(labelAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
    rest.onBlur?.({} as any);
  };

  const borderColor = error
    ? Colors.error
    : focused
    ? Colors.accent
    : Colors.border;

  return (
    <View style={[s.wrapper, containerStyle]}>
      {label && <Text style={s.label}>{label}</Text>}

      <View
        style={[
          s.container,
          IS_ANDROID ? s.containerAndroid : s.containerIOS,
          { borderColor },
          error && { borderColor: Colors.error },
        ]}
      >
        {icon && <View style={s.iconLeft}>{icon}</View>}

        <TextInput
          style={[
            s.input,
            icon && { paddingLeft: 0 },
            style,
          ]}
          placeholderTextColor={Colors.textMuted}
          onFocus={onFocus}
          onBlur={onBlur}
          {...rest}
        />

        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={8}
            style={s.iconRight}
          >
            {rightIcon}
          </Pressable>
        )}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  containerIOS: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  containerAndroid: {
    borderRadius: 4,
    borderBottomWidth: 2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 14,
  },
  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 8 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  error: {
    fontSize: 12,
    color: Colors.errorText,
    marginTop: 4,
  },
});
