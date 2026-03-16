// components/ui/AppHeader.tsx
// Cross-platform header: GlassHeader on iOS, M3Header on Android.
import React from 'react';

import { IS_ANDROID } from '@/constants/Platform';
import { GlassHeader } from './ios/GlassHeader';
import { M3Header } from './android/M3Header';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  large?: boolean;
}

export function AppHeader(props: AppHeaderProps) {
  if (IS_ANDROID) {
    return <M3Header {...props} />;
  }
  return <GlassHeader {...props} />;
}
