// app/(staff)/_layout.tsx
// Staff native tab bar.
// Tabs: Jobs | Scanner | Schedule | Performance | More
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { MoreMenu, MoreMenuItem } from '@/components/MoreMenu';

// ─── More-menu items ──────────────────────────────────────────────────────────

function getMoreItems(logout: () => void): MoreMenuItem[] {
  return [
    { label: 'Location Tracking', icon: 'navigate-outline',        route: '/(staff)/tracking'   },
    { label: 'Fleet Map',         icon: 'map-outline',             route: '/(staff)/fleet'      },
    { label: 'Inventory',         icon: 'cube-outline',            route: '/(staff)/inventory'  },
    { label: 'Reports',           icon: 'bar-chart-outline',       route: '/(staff)/reports'    },
    { label: 'Walk-in',           icon: 'walk-outline',            route: '/(staff)/walkin'     },
    { label: 'Kiosk',             icon: 'tablet-portrait-outline', route: '/(staff)/kiosk'      },
    { label: 'Settings',          icon: 'settings-outline',        route: '/(staff)/settings'   },
    { label: 'Log Out',           icon: 'log-out-outline',         onPress: logout, danger: true },
  ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function StaffLayout() {
  const { user, loading, logout } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!user || user.role !== 'staff') {
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
        {/* ── Jobs ─────────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Scanner — full-screen camera, tab bar hidden ──────────────── */}
        <Tabs.Screen
          name="scanner"
          options={{
            title: 'Scanner',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'scan' : 'scan-outline'} size={24} color={color} />
            ),
            tabBarStyle: { display: 'none' },
          }}
        />

        {/* ── Schedule ─────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Performance ──────────────────────────────────────────────── */}
        <Tabs.Screen
          name="performance"
          options={{
            title: 'Performance',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={24} color={color} />
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
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Kiosk — full-screen tablet UI ─────────────────────────────── */}
        <Tabs.Screen
          name="kiosk"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden routes — routable via More menu ────────────────────── */}
        <Tabs.Screen name="tracking"  options={{ href: null }} />
        <Tabs.Screen name="inventory" options={{ href: null }} />
        <Tabs.Screen name="reports"   options={{ href: null }} />
        <Tabs.Screen name="walkin"    options={{ href: null }} />
        <Tabs.Screen name="settings"  options={{ href: null }} />
      </Tabs>

      <MoreMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        items={moreItems}
      />
    </>
  );
}
