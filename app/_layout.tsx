// _layout.tsx
// Background task definitions must be registered at the top level before any
// component mounts. Importing this file is enough — the defineTask call
// executes at module load time.
import '@/tasks/jobTrackingTask';
import '@/tasks/locationTask';

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Slot, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const ONBOARDING_ROUTE = "/onboarding-screen";

/** Returns the correct home route for the current user's role. */
function homeForRole(role?: string): string {
  if (role === "customer") return "/(customer)/home";
  return "/(tabs)/home";
}

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [shouldOnboard, setShouldOnboard] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const navigatingRef = useRef(false);
  const lastCheckedPathRef = useRef<string | null>(null);

  // Initial read once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem("hasOnboarded");
        if (mounted) setShouldOnboard(v !== "true");
      } finally {
        if (mounted) setCheckingOnboarding(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Re-check flag when leaving onboarding or landing on auth
  useEffect(() => {
    const isOnboarding = pathname === ONBOARDING_ROUTE;
    const isAuthRoute =
      pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/forgot") ||
      pathname.startsWith("/auth/reset-password");

    if (lastCheckedPathRef.current === pathname) return;
    lastCheckedPathRef.current = pathname;

    if (!isOnboarding || isAuthRoute) {
      (async () => {
        const v = await AsyncStorage.getItem("hasOnboarded");
        setShouldOnboard(v !== "true");
      })();
    }
  }, [pathname]);

  // Navigation guard
  useEffect(() => {
    if (loading) return;
    if (navigatingRef.current) return;

    (async () => {
      const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE);
      const isPublicAuth =
        pathname.startsWith("/auth/login") ||
        pathname.startsWith("/auth/forgot") ||
        pathname.startsWith("/auth/reset-password");

      // Re-read onboarding flag to avoid stale state
      let pending = shouldOnboard;
      if (!isOnboarding) {
        const v = await AsyncStorage.getItem("hasOnboarded");
        pending = v !== "true";
        if (pending !== shouldOnboard) setShouldOnboard(pending);
      }

      if (pending && !isOnboarding) {
        if (pathname !== ONBOARDING_ROUTE) {
          navigatingRef.current = true;
          router.replace(ONBOARDING_ROUTE);
          setTimeout(() => (navigatingRef.current = false), 0);
        }
        return;
      }

      if (!user && !isOnboarding && !isPublicAuth) {
        if (pathname !== "/auth/login") {
          navigatingRef.current = true;
          router.replace("/auth/login");
          setTimeout(() => (navigatingRef.current = false), 0);
        }
        return;
      }

      // Redirect authenticated user away from auth screens to their home
      if (user && isPublicAuth) {
        const dest = homeForRole(user.role);
        navigatingRef.current = true;
        router.replace(dest);
        setTimeout(() => (navigatingRef.current = false), 0);
      }
    })();
  }, [user, loading, pathname, shouldOnboard, router]);

  // Remount subtree on auth/role/onboarding state changes
  const slotKey = useMemo(
    () =>
      `${Boolean(user)}-${user?.role ?? "guest"}-${shouldOnboard ? "onb" : "done"}`,
    [user, shouldOnboard]
  );

  if (loading || checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  if (shouldOnboard && !pathname.startsWith(ONBOARDING_ROUTE)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  return <Slot key={slotKey} />;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const colorScheme = useColorScheme();
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === "light" ? DefaultTheme : DarkTheme}>
          <AuthGate />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
