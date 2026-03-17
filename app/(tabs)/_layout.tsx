// app/(tabs)/_layout.tsx
// Admin + Staff native tab bar.
// Admin sees:  Home | Bookings | Staff | Revenue  (+ hidden routes)
// Staff sees:  Jobs  | Scanner | Tracking | Sales  (+ hidden routes)
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ── Colors ─────────────────────────────────────────────────────
        tabBarActiveTintColor:   Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,

        // ── Label ──────────────────────────────────────────────────────
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },

        // ── Platform bar style ─────────────────────────────────────────
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',   // floats over content — blur shows through
            borderTopWidth: 0,
            elevation: 0,
          },
          android: {
            backgroundColor: Colors.surface,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            elevation: 8,
            height: 60,
          },
        }),

        // ── iOS native blur ────────────────────────────────────────────
        tabBarBackground: Platform.OS === 'ios'
          ? () => (
              <BlurView
                tint="systemUltraThinMaterial"
                intensity={100}
                style={StyleSheet.absoluteFill}
              />
            )
          : undefined,
      }}
    >
      {/* ── Home / Dashboard ─────────────────────────────────────────── */}
      <Tabs.Screen
        name="home"
        options={{
          title: isAdmin ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* ── Jobs / Bookings ───────────────────────────────────────────── */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: isAdmin ? 'Bookings' : 'Jobs',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* ── Workers — admin only ──────────────────────────────────────── */}
      <Tabs.Protected guard={isAdmin}>
        <Tabs.Screen
          name="workers"
          options={{
            title: 'Staff',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
            ),
          }}
        />
      </Tabs.Protected>

      {/* ── Transactions / Revenue ────────────────────────────────────── */}
      <Tabs.Screen
        name="transactions"
        options={{
          title: isAdmin ? 'Revenue' : 'Sales',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
          ),
          // Hide from admin tab bar — admin uses the tab group differently
          tabBarButton: isAdmin ? undefined : undefined,
        }}
      />

      {/* ── Scanner — staff only ──────────────────────────────────────── */}
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={24} color={color} />
          ),
          // Show only for staff; hide from admin tab bar
          tabBarButton: isStaff ? undefined : () => null,
          // Scanner needs full screen — hide tab bar when active
          tabBarStyle: { display: 'none' },
        }}
      />

      {/* ── Tracking — staff only ─────────────────────────────────────── */}
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Tracking',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'navigate' : 'navigate-outline'} size={24} color={color} />
          ),
          tabBarButton: isStaff ? undefined : () => null,
        }}
      />

      {/* ── Fleet — full-screen map, tab bar hidden ───────────────────── */}
      <Tabs.Screen
        name="fleet"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />

      {/* ── Kiosk — full-screen tablet UI, tab bar hidden ─────────────── */}
      <Tabs.Screen
        name="kiosk"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />

      {/* ── Hidden routes — routable, not in tab bar ──────────────────── */}
      <Tabs.Screen name="settings"           options={{ href: null }} />
      <Tabs.Screen name="services"           options={{ href: null }} />
      <Tabs.Screen name="packages"           options={{ href: null }} />
      <Tabs.Screen name="walkin"             options={{ href: null }} />
      <Tabs.Screen name="queue"              options={{ href: null }} />
      <Tabs.Screen name="reports"            options={{ href: null }} />
      <Tabs.Screen name="inventory"          options={{ href: null }} />
      <Tabs.Screen name="reviews"            options={{ href: null }} />
      <Tabs.Screen name="subscription-plans" options={{ href: null }} />
      <Tabs.Screen name="marketing"          options={{ href: null }} />
      <Tabs.Screen name="ai"                 options={{ href: null }} />
    </Tabs>
  );
}
