// components/ui/AppTextInput.tsx
// Cross-platform text input with platform-native styling.
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { IS_ANDROID } from '@/constants/Platform';
import { Typography } from '@/constants/Typography';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function AppTextInput({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: AppTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[s.container, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        style={[
          s.input,
          IS_ANDROID ? s.inputAndroid : s.inputIOS,
          focused && s.inputFocused,
          error && s.inputError,
          style,
        ]}
        placeholderTextColor={Colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    ...Typography.label,
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputIOS: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputAndroid: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  inputFocused: {
    borderColor: Colors.accent,
    borderBottomColor: Colors.accent,
  },
  inputError: {
    borderColor: Colors.error,
    borderBottomColor: Colors.error,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.errorText,
    marginTop: 4,
  },
});
