// constants/secureStoreKeys.ts
// Centralised keys for expo-secure-store.
// Import this wherever you read/write to SecureStore so key names stay in sync.

export const SECURE_STORE_KEYS = {
  AUTH_TOKEN:  'washhub.authToken',
  BUSINESS_ID: 'washhub.businessId',
  USER_ROLE:   'washhub.userRole',
} as const;

export type SecureStoreKey = (typeof SECURE_STORE_KEYS)[keyof typeof SECURE_STORE_KEYS];
