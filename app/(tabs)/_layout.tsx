// app/(tabs)/_layout.tsx
// Admin-only native tab bar with "More" overflow sheet.
//
// Admin → Dashboard | Bookings | Staff | Revenue | More
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, Redirect } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { MoreMenu, MoreMenuItem } from "@/components/MoreMenu";

// ─── More-menu items (admin) ──────────────────────────────────────────────────

function getMoreItems(logout: () => void): MoreMenuItem[] {
  return [
    { label: 'Services',           icon: 'cut-outline',             route: '/(tabs)/services'           },
    { label: 'Packages',           icon: 'gift-outline',            route: '/(tabs)/packages'           },
    { label: 'Inventory',          icon: 'cube-outline',            route: '/(tabs)/inventory'          },
    { label: 'Marketing',          icon: 'megaphone-outline',       route: '/(tabs)/marketing'          },
    { label: 'Queue',              icon: 'list-outline',            route: '/(tabs)/queue'              },
    { label: 'Fleet Map',          icon: 'map-outline',             route: '/(tabs)/fleet'              },
    { label: 'Reports',            icon: 'bar-chart-outline',       route: '/(tabs)/reports'            },
    { label: 'AI Hub',             icon: 'sparkles-outline',        route: '/(tabs)/ai'                 },
    { label: 'Walk-in',            icon: 'walk-outline',            route: '/(tabs)/walkin'             },
    { label: 'Reviews',            icon: 'star-outline',            route: '/(tabs)/reviews'            },
    { label: 'Subscription Plans', icon: 'card-outline',            route: '/(tabs)/subscription-plans' },
    { label: 'Settings',           icon: 'settings-outline',        route: '/(tabs)/settings'           },
    { label: 'Log Out',            icon: 'log-out-outline',         onPress: logout, danger: true       },
  ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { user, loading, logout } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Redirect href="/auth/login" />;
  }

  const moreItems = getMoreItems(logout);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   Colors.accent,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
              borderTopWidth: 0,
              elevation: 0,
              backgroundColor: 'transparent',
            },
            android: {
              backgroundColor: Colors.surface,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
              elevation: 8,
              height: 60,
            },
          }),
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
        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Bookings ──────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Bookings',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Staff ─────────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="workers"
          options={{
            title: 'Staff',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Revenue ───────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Revenue',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── More — intercepts tabPress, opens MoreMenu sheet ─────────── */}
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => (
              <Ionicons name="ellipsis-horizontal" size={24} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreVisible(true);
            },
          }}
        />

        {/* ── Fleet — full-screen map ───────────────────────────────────── */}
        <Tabs.Screen
          name="fleet"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Kiosk — full-screen tablet UI ─────────────────────────────── */}
        <Tabs.Screen
          name="kiosk"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Staff-only screens — declared so router doesn't warn ──────── */}
        <Tabs.Screen name="scanner"     options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }} />
        <Tabs.Screen name="schedule"    options={{ href: null }} />
        <Tabs.Screen name="performance" options={{ href: null }} />
        <Tabs.Screen name="tracking"    options={{ href: null }} />

        {/* ── Hidden routes — routable via More menu ────────────────────── */}
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

      <MoreMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        items={moreItems}
      />
    </>
  );
}
