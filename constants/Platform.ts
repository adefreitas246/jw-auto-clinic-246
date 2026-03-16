// constants/Platform.ts
import { Platform, PlatformIOSStatic } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';
export const IS_WEB = Platform.OS === 'web';

export const IOS_VERSION: number = IS_IOS
  ? parseInt(String((Platform as PlatformIOSStatic).Version), 10)
  : 0;

export const ANDROID_VERSION: number = IS_ANDROID
  ? (Platform.Version as number)
  : 0;

/** iOS 26+ supports Liquid Glass */
export const SUPPORTS_LIQUID_GLASS = IS_IOS && IOS_VERSION >= 26;

/** Android 12+ (API 31+) supports Material You dynamic color */
export const SUPPORTS_MATERIAL_YOU = IS_ANDROID && ANDROID_VERSION >= 31;

/** Use blur effects on iOS; elevation on Android */
export const USE_BLUR = IS_IOS;

export default {
  IS_IOS,
  IS_ANDROID,
  IS_WEB,
  IOS_VERSION,
  ANDROID_VERSION,
  SUPPORTS_LIQUID_GLASS,
  SUPPORTS_MATERIAL_YOU,
  USE_BLUR,
};
