// constants/Layout.ts
import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.select({
  ios: 83,      // 49px bar + safe area
  android: 60,
  default: 60,
});

export const SCROLL_PADDING_BOTTOM = Platform.select({
  ios: 100,     // tab bar + extra breathing room
  android: 76,
  default: 76,
});

/** @deprecated Use SCROLL_PADDING_BOTTOM */
export const CONTENT_PADDING_BOTTOM = SCROLL_PADDING_BOTTOM;
