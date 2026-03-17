// app/(staff)/more.tsx
// Dummy route — tab press is intercepted by the layout listener.
import { Redirect } from 'expo-router';
export default function StaffMoreScreen() {
  return <Redirect href="/(staff)/jobs" />;
}
