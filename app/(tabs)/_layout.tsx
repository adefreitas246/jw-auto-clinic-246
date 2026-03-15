import { CustomTabBar } from "@/components/CustomTabBar";
import { useAuth } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TransparentHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        height: insets.top, // just reserve safe-area space; no visible UI
        backgroundColor: "transparent",
      }}
    >
      <StatusBar style="dark" translucent />
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        // Show header only on mobile platforms
        headerShown: Platform.OS !== "web",
        // Make it truly transparent
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerTitle: "",
        // Provide a no-op transparent header (prevents route title)
        header: () => <TransparentHeader />,
      }}
    >
      {/* Primary tabs — visible in CustomTabBar per role */}
      <Tabs.Screen name="home"         />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="jobs"         />
      <Tabs.Protected guard={user?.role === "admin"}>
        <Tabs.Screen name="workers" />
      </Tabs.Protected>
      {/* Staff tabs — visible for staff role in CustomTabBar */}
      <Tabs.Screen name="scanner"  options={{ href: null }} />
      <Tabs.Screen name="tracking" options={{ href: null }} />
      {/* Overflow (More menu) + all other routable screens */}
      <Tabs.Screen name="settings"  options={{ href: null }} />
      <Tabs.Screen name="services"  options={{ href: null }} />
      <Tabs.Screen name="packages"  options={{ href: null }} />
      <Tabs.Screen name="fleet"     options={{ href: null }} />
      <Tabs.Screen name="kiosk"     options={{ href: null }} />
      <Tabs.Screen name="walkin"    options={{ href: null }} />
      <Tabs.Screen name="queue"     options={{ href: null }} />
      <Tabs.Screen name="reports"   options={{ href: null }} />
      <Tabs.Screen name="inventory"           options={{ href: null }} />
      <Tabs.Screen name="reviews"             options={{ href: null }} />
      <Tabs.Screen name="subscription-plans" options={{ href: null }} />
      <Tabs.Screen name="marketing"          options={{ href: null }} />
      <Tabs.Screen name="ai"                 options={{ href: null }} />
    </Tabs>
  );
}
