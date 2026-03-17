// app/(tabs)/_layout.tsx
// Admin + Staff native tab bar with "More" overflow sheet.
//
// Admin → Dashboard | Bookings | Staff | Revenue | More
// Staff → Jobs | Scanner | Schedule | Performance | More
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";
import { MoreMenu, MoreMenuItem } from "@/components/MoreMenu";

// ─── More-menu items per role ─────────────────────────────────────────────────

function getMoreItems(
  role: string | undefined,
  logout: () => void
): MoreMenuItem[] {
  const shared: MoreMenuItem[] = [
    { label: 'Settings',  icon: 'settings-outline',  route: '/(tabs)/settings'  },
    { label: 'Log Out',   icon: 'log-out-outline',    onPress: logout, danger: true },
  ];

  if (role === 'admin') {
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
      ...shared,
    ];
  }

  // staff
  return [
    { label: 'Location Tracking', icon: 'navigate-outline',        route: '/(tabs)/tracking'   },
    { label: 'Fleet Map',         icon: 'map-outline',             route: '/(tabs)/fleet'      },
    { label: 'Inventory',         icon: 'cube-outline',            route: '/(tabs)/inventory'  },
    { label: 'Reports',           icon: 'bar-chart-outline',       route: '/(tabs)/reports'    },
    { label: 'Walk-in',           icon: 'walk-outline',            route: '/(tabs)/walkin'     },
    { label: 'Kiosk',             icon: 'tablet-portrait-outline', route: '/(tabs)/kiosk'      },
    ...shared,
  ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { user, logout } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const moreItems = getMoreItems(user?.role, logout);

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
        {/* ── Home / Dashboard — admin only ─────────────────────────────── */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
            tabBarButton: isAdmin ? undefined : () => null,
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

        {/* ── Revenue — admin only ──────────────────────────────────────── */}
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Revenue',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
            ),
            tabBarButton: isAdmin ? undefined : () => null,
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
            tabBarButton: isStaff ? undefined : () => null,
            tabBarStyle: { display: 'none' },
          }}
        />

        {/* ── Schedule — staff only ─────────────────────────────────────── */}
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),
            tabBarButton: isStaff ? undefined : () => null,
          }}
        />

        {/* ── Performance — staff only ──────────────────────────────────── */}
        <Tabs.Screen
          name="performance"
          options={{
            title: 'Performance',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={24} color={color} />
            ),
            tabBarButton: isStaff ? undefined : () => null,
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
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Kiosk — full-screen tablet UI ─────────────────────────────── */}
        <Tabs.Screen
          name="kiosk"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden routes — routable, not in tab bar ──────────────────── */}
        <Tabs.Screen name="tracking"           options={{ href: null }} />
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
