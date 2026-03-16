// components/ui/AppStatusBadge.tsx
// Status badge for job/booking status display.
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

type StatusVariant =
  | 'pending'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

interface AppStatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  style?: ViewStyle;
}

const STATUS_STYLES: Record<
  StatusVariant,
  { bg: string; text: string; dot: string }
> = {
  pending:     { bg: Colors.warningBg,  text: Colors.warningText,  dot: Colors.warning },
  active:      { bg: Colors.infoBg,     text: Colors.infoText,     dot: Colors.info },
  in_progress: { bg: Colors.accentMuted, text: Colors.accentDark,  dot: Colors.accent },
  completed:   { bg: Colors.successBg,  text: Colors.successText,  dot: Colors.success },
  cancelled:   { bg: Colors.errorBg,    text: Colors.errorText,    dot: Colors.error },
  success:     { bg: Colors.successBg,  text: Colors.successText,  dot: Colors.success },
  warning:     { bg: Colors.warningBg,  text: Colors.warningText,  dot: Colors.warning },
  error:       { bg: Colors.errorBg,    text: Colors.errorText,    dot: Colors.error },
  info:        { bg: Colors.infoBg,     text: Colors.infoText,     dot: Colors.info },
};

function normalise(status: string): StatusVariant {
  return (STATUS_STYLES[status as StatusVariant]
    ? status
    : 'info') as StatusVariant;
}

export function AppStatusBadge({ status, label, style }: AppStatusBadgeProps) {
  const key = normalise(status);
  const { bg, text, dot } = STATUS_STYLES[key];
  const display = label ?? status.replace(/_/g, ' ');

  return (
    <View style={[s.badge, { backgroundColor: bg }, style]}>
      <View style={[s.dot, { backgroundColor: dot }]} />
      <Text style={[Typography.caption, { color: text, fontWeight: '600' }]}>
        {display}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
