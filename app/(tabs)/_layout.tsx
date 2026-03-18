// app/(tabs)/_layout.tsx
// Staff-only native tab bar with "More" overflow sheet.
//
// Staff → Jobs | Scanner | Schedule | Stats | More
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
  { icon: 'navigate-outline',       label: 'Tracking',      route: '/(tabs)/tracking'   },
  { icon: 'map-outline',            label: 'Fleet Map',      route: '/(tabs)/fleet'      },
  { icon: 'cube-outline',           label: 'Inventory',      route: '/(tabs)/inventory'  },
  { icon: 'people-outline',         label: 'Walk-in Queue',  route: '/(tabs)/walkin'     },
  { icon: 'tablet-portrait-outline',label: 'Kiosk Mode',     route: '/(tabs)/kiosk'      },
  { icon: 'settings-outline',       label: 'Settings',       route: '/(tabs)/settings'   },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function StaffLayout() {
  const { user } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  // ── Role guard ──────────────────────────────────────────────────────────────
  if (!user || user.role !== 'staff') {
    return <Redirect href="/auth/login" />;
  }

  function handleMoreNav(route: string) {
    setMoreVisible(false);
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

        {/* ── Tab 1: Jobs ────────────────────────────────────────────── */}
        <Tabs.Screen
          name="jobs/index"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 2: Scanner ─────────────────────────────────────────── */}
        <Tabs.Screen
          name="scanner"
          options={{
            title: 'Scanner',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={24} color={color} />
            ),
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />

        {/* ── Tab 3: Schedule ────────────────────────────────────────── */}
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 4: Performance ─────────────────────────────────────── */}
        <Tabs.Screen
          name="performance"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* ── Tab 5: More — intercepts tabPress, opens sheet ─────────── */}
        <Tabs.Screen
          name="more-staff"
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

        {/* ── Hidden: job detail — tab bar hidden ────────────────────── */}
        <Tabs.Screen
          name="jobs/[id]"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Hidden: GPS tracking — tab bar hidden ──────────────────── */}
        <Tabs.Screen
          name="tracking"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Hidden: fleet map — tab bar hidden ─────────────────────── */}
        <Tabs.Screen
          name="fleet"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Hidden: kiosk — tab bar hidden ─────────────────────────── */}
        <Tabs.Screen
          name="kiosk"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Hidden: walk-in — tab bar hidden ───────────────────────── */}
        <Tabs.Screen
          name="walkin"
          options={{ href: null, tabBarStyle: { display: 'none' }, headerShown: false }}
        />

        {/* ── Routable but not in tab bar ────────────────────────────── */}
        <Tabs.Screen name="inventory"          options={{ href: null }} />
        <Tabs.Screen name="settings"           options={{ href: null }} />

        {/* ── Admin-only screens — declared so router doesn't warn ───── */}
        <Tabs.Screen name="home"               options={{ href: null }} />
        <Tabs.Screen name="jobs"               options={{ href: null }} />
        <Tabs.Screen name="workers"            options={{ href: null }} />
        <Tabs.Screen name="transactions"       options={{ href: null }} />
        <Tabs.Screen name="more"               options={{ href: null }} />
        <Tabs.Screen name="services"           options={{ href: null }} />
        <Tabs.Screen name="packages"           options={{ href: null }} />
        <Tabs.Screen name="queue"              options={{ href: null }} />
        <Tabs.Screen name="reports"            options={{ href: null }} />
        <Tabs.Screen name="reviews"            options={{ href: null }} />
        <Tabs.Screen name="subscription-plans" options={{ href: null }} />
        <Tabs.Screen name="marketing"          options={{ href: null }} />
        <Tabs.Screen name="ai"                 options={{ href: null }} />

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
