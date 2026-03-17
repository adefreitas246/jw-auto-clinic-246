// app/(customer)/_layout.tsx
// Customer native tab bar.
// Tabs: Home | Browse | Vehicles | Rewards | More
// Booking / track / rate screens hide the tab bar (immersive flows).
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
    { label: 'My Bookings',        icon: 'calendar-outline',    route: '/(customer)/booking'       },
    { label: 'Subscriptions',      icon: 'card-outline',        route: '/(customer)/subscriptions' },
    { label: 'Refer a Friend',     icon: 'gift-outline',        route: '/(customer)/referral'      },
    { label: 'Rate a Service',     icon: 'star-outline',        route: '/(customer)/rate'          },
    { label: 'Profile & Settings', icon: 'person-outline',      route: '/(customer)/settings'      },
    { label: 'Log Out',            icon: 'log-out-outline',     onPress: logout, danger: true      },
  ];
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function CustomerLayout() {
  const { user, loading, logout } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!user || user.role !== 'customer') {
    return <Redirect href="/auth/login" />;
  }

  const moreItems = getMoreItems(logout);

  return (
    <>
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
        {/* ── Home ─────────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Catalog / Browse ──────────────────────────────────────────── */}
        <Tabs.Screen
          name="catalog"
          options={{
            title: 'Browse',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'layers' : 'layers-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Vehicles ──────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="vehicles"
          options={{
            title: 'Vehicles',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'car' : 'car-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Loyalty / Rewards ─────────────────────────────────────────── */}
        <Tabs.Screen
          name="loyalty"
          options={{
            title: 'Rewards',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'star' : 'star-outline'} size={24} color={color} />
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

        {/* ── Booking flow — immersive, tab bar hidden ──────────────────── */}
        <Tabs.Screen
          name="book"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />

        {/* ── Job tracking — immersive, tab bar hidden ───────────────────── */}
        <Tabs.Screen
          name="track"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />

        {/* ── Rate / review — deep-linked, tab bar hidden ───────────────── */}
        <Tabs.Screen
          name="rate"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />

        {/* ── Hidden routes — routable, not in tab bar ──────────────────── */}
        <Tabs.Screen name="booking"       options={{ href: null }} />
        <Tabs.Screen name="subscriptions" options={{ href: null }} />
        <Tabs.Screen name="referral"      options={{ href: null }} />
        <Tabs.Screen name="settings"      options={{ href: null }} />
      </Tabs>

      <MoreMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        items={moreItems}
      />
    </>
  );
}
