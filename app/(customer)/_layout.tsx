// app/(customer)/_layout.tsx
// Customer tab navigator — 5 tabs + More bottom sheet.
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs, router } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

// ── More sheet items ───────────────────────────────────────────────────────────

type MoreItem = {
  icon:  React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
};

const MORE_ITEMS: MoreItem[] = [
  { icon: 'grid-outline',     label: 'Catalog',        route: '/(customer)/catalog'       },
  { icon: 'card-outline',     label: 'Subscriptions',  route: '/(customer)/subscriptions' },
  { icon: 'people-outline',   label: 'Refer a Friend', route: '/(customer)/referral'      },
  { icon: 'settings-outline', label: 'Settings',       route: '/(customer)/settings'      },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function CustomerLayout() {
  const { user } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  // ── Role guard ──────────────────────────────────────────────────────────────
  if (!user || user.role !== 'customer') {
    return <Redirect href="/auth/login" />;
  }

  function handleMoreNav(route: string) {
    setMoreVisible(false);
    // Small delay so the sheet closes before push animation starts
    setTimeout(() => router.push(route as any), 50);
  }

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

        {/* ── Tab 1: Home ───────────────────────────────────────────────── */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 2: Book ───────────────────────────────────────────────── */}
        <Tabs.Screen
          name="book"
          options={{
            title: 'Book',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 3: My Washes ──────────────────────────────────────────── */}
        <Tabs.Screen
          name="booking"
          options={{
            title: 'My Washes',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'water' : 'water-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 4: Rewards ────────────────────────────────────────────── */}
        <Tabs.Screen
          name="loyalty"
          options={{
            title: 'Rewards',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'star' : 'star-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 5: More — intercepts tabPress, opens sheet ────────────── */}
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

        {/* ── Hidden: book sub-steps — tab bar hidden ───────────────────── */}
        <Tabs.Screen
          name="book/[step]"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden: booking detail — tab bar hidden ───────────────────── */}
        <Tabs.Screen
          name="booking/[id]"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden: live job tracking — tab bar hidden ────────────────── */}
        <Tabs.Screen
          name="track/[id]"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden: rate screen — tab bar hidden ──────────────────────── */}
        <Tabs.Screen
          name="rate/[bookingId]"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden: vehicle add — tab bar hidden ──────────────────────── */}
        <Tabs.Screen
          name="vehicles/add"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Hidden: vehicle detail/edit — tab bar hidden ──────────────── */}
        <Tabs.Screen
          name="vehicles/[id]"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />

        {/* ── Routable but not in tab bar ───────────────────────────────── */}
        <Tabs.Screen name="rate"          options={{ href: null }} />
        <Tabs.Screen name="track"         options={{ href: null }} />
        <Tabs.Screen name="vehicles"      options={{ href: null }} />
        <Tabs.Screen name="catalog"       options={{ href: null }} />
        <Tabs.Screen name="subscriptions" options={{ href: null }} />
        <Tabs.Screen name="referral"      options={{ href: null }} />
        <Tabs.Screen name="settings"      options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />

      </Tabs>

      {/* ── More bottom sheet ─────────────────────────────────────────────── */}
      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreVisible(false)}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable style={sh.backdrop} onPress={() => setMoreVisible(false)} />

        {/* Sheet */}
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <Text style={sh.sheetTitle}>More</Text>

          {MORE_ITEMS.map((item, i) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                sh.row,
                i < MORE_ITEMS.length - 1 && sh.rowBorder,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleMoreNav(item.route)}
              android_ripple={{ color: Colors.accent + '18', borderless: false }}
            >
              <View style={sh.iconWrap}>
                <Ionicons name={item.icon} size={20} color={Colors.accent} />
              </View>
              <Text style={sh.rowLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.border} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,22,40,0.5)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
