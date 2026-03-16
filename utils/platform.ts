// utils/platform.ts
import { Platform, PlatformIOSStatic } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';
export const IS_WEB = Platform.OS === 'web';

// iOS version detection for Liquid Glass (iOS 26+)
const iosVersion = IS_IOS
  ? parseInt((Platform as PlatformIOSStatic).Version as string, 10)
  : 0;
export const SUPPORTS_LIQUID_GLASS = IS_IOS && iosVersion >= 26;
export const SUPPORTS_DYNAMIC_ISLAND = IS_IOS && iosVersion >= 16;

// Android API level detection for Material You
export const ANDROID_API = IS_ANDROID
  ? (Platform as any).Version as number
  : 0;
export const SUPPORTS_MATERIAL_YOU = IS_ANDROID && ANDROID_API >= 31;
export const SUPPORTS_PREDICTIVE_BACK = IS_ANDROID && ANDROID_API >= 33;

export default {
  IS_IOS,
  IS_ANDROID,
  IS_WEB,
  SUPPORTS_LIQUID_GLASS,
  SUPPORTS_DYNAMIC_ISLAND,
  ANDROID_API,
  SUPPORTS_MATERIAL_YOU,
  SUPPORTS_PREDICTIVE_BACK,
};
