// components/ui/Badge.tsx
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

type Status = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'active' | 'completed' | 'cancelled' | 'in_progress';

interface BadgeProps {
  status?: Status | string;
  label?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

const CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  success:     { bg: Colors.successBg,  text: Colors.successText,  dot: Colors.success  },
  completed:   { bg: Colors.successBg,  text: Colors.successText,  dot: Colors.success  },
  warning:     { bg: Colors.warningBg,  text: Colors.warningText,  dot: Colors.warning  },
  pending:     { bg: Colors.warningBg,  text: Colors.warningText,  dot: Colors.warning  },
  error:       { bg: Colors.errorBg,    text: Colors.errorText,    dot: Colors.error    },
  cancelled:   { bg: Colors.errorBg,    text: Colors.errorText,    dot: Colors.error    },
  info:        { bg: Colors.infoBg,     text: Colors.infoText,     dot: Colors.info     },
  active:      { bg: Colors.accentMuted, text: Colors.accentDark,  dot: Colors.accent   },
  in_progress: { bg: Colors.accentMuted, text: Colors.accentDark,  dot: Colors.accent   },
};

const fallback = { bg: Colors.surfaceAlt, text: Colors.textSecondary, dot: Colors.textMuted };

export function Badge({ status = 'info', label, style, size = 'md' }: BadgeProps) {
  const cfg = CONFIG[status] ?? fallback;
  const display = label ?? status.toString().replace(/_/g, ' ');

  return (
    <View
      style={[
        s.badge,
        { backgroundColor: cfg.bg, paddingVertical: size === 'sm' ? 3 : 5 },
        style,
      ]}
    >
      <View style={[s.dot, { backgroundColor: cfg.dot }]} />
      <Text
        style={[
          s.text,
          { color: cfg.text, fontSize: size === 'sm' ? 11 : 12 },
        ]}
      >
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
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
