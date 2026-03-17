// app/(customer)/more.tsx
// Dummy route — tab press is intercepted by the layout listener
// so this screen is never actually rendered in normal use.
import { Redirect } from 'expo-router';
export default function CustomerMoreScreen() {
  return <Redirect href="/(customer)/home" />;
}
