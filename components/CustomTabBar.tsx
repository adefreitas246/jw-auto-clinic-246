// components/CustomTabBar.tsx
// Role-based floating tab bar for staff (admin / staff roles).
// Shows 4 role-specific tabs + a "More" button that opens MoreMenu.
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView as ExpoBlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { MoreMenu, MoreMenuItem } from './MoreMenu';
import { Colors } from '@/constants/Colors';

Animatable.initializeRegistryWithDefinitions({
  wiggle: {
    0:    { transform: [{ rotate: '0deg'   }] },
    0.25: { transform: [{ rotate: '-10deg' }] },
    0.5:  { transform: [{ rotate: '10deg'  }] },
    0.75: { transform: [{ rotate: '-10deg' }] },
    1:    { transform: [{ rotate: '0deg'   }] },
  },
});

// ─── Tab icon config ──────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { icon: IconName; activeIcon: IconName; label: string; animation: string }> = {
  home:         { icon: 'home-outline',       activeIcon: 'home',            label: 'Home',        animation: 'wiggle'     },
  transactions: { icon: 'add-circle-outline', activeIcon: 'add-circle',      label: 'Add',         animation: 'pulse'      },
  jobs:         { icon: 'briefcase-outline',  activeIcon: 'briefcase',       label: 'Jobs',        animation: 'pulse'      },
  workers:      { icon: 'people-outline',     activeIcon: 'people',          label: 'Workers',     animation: 'rubberBand' },
  scanner:      { icon: 'scan-outline',       activeIcon: 'scan',            label: 'Scanner',     animation: 'pulse'      },
  tracking:     { icon: 'navigate-outline',   activeIcon: 'navigate',        label: 'Tracking',    animation: 'pulse'      },
  settings:     { icon: 'settings-outline',   activeIcon: 'settings',        label: 'Settings',    animation: 'flipInY'    },
};

// Routes shown per role (order matters — left to right)
const ROLE_TABS: Record<string, string[]> = {
  admin: ['home', 'jobs', 'workers', 'transactions'],
  staff: ['jobs', 'scanner', 'tracking', 'transactions'],
};

const activeColor   = Colors.accent;
const inactiveColor = Colors.textPrimary;

// ─── More-menu items per role ─────────────────────────────────────────────────

function getMoreItems(role: string | undefined, logout: () => void): MoreMenuItem[] {
  const base: MoreMenuItem[] = [
    { label: 'Settings',    icon: 'settings-outline',    route: '/(tabs)/settings'  },
    { label: 'Log Out',     icon: 'log-out-outline',     onPress: logout, danger: true },
  ];

  if (role === 'admin') {
    return [
      { label: 'Services',    icon: 'cut-outline',         route: '/(tabs)/services'   },
      { label: 'Packages',    icon: 'gift-outline',        route: '/(tabs)/packages'   },
      { label: 'Inventory',   icon: 'cube-outline',        route: '/(tabs)/inventory'  },
      { label: 'Marketing',   icon: 'megaphone-outline',   route: '/(tabs)/marketing'  },
      { label: 'Fleet Map',   icon: 'map-outline',         route: '/(tabs)/fleet'      },
      { label: 'Queue',       icon: 'list-outline',        route: '/(tabs)/queue'      },
      { label: 'Kiosk',       icon: 'tablet-portrait-outline', route: '/(tabs)/kiosk'  },
      { label: 'Reports',     icon: 'bar-chart-outline',   route: '/(tabs)/reports'    },
      { label: 'AI Hub',      icon: 'sparkles-outline',    route: '/(tabs)/ai'         },
      ...base,
    ];
  }

  // staff
  return [
    { label: 'Fleet Map',   icon: 'map-outline',         route: '/(tabs)/fleet'      },
    { label: 'Inventory',   icon: 'cube-outline',        route: '/(tabs)/inventory'  },
    { label: 'Reports',     icon: 'bar-chart-outline',   route: '/(tabs)/reports'    },
    ...base,
  ];
}

// ─── Main tab bar ─────────────────────────────────────────────────────────────

export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const [webMenuOpen,  setWebMenuOpen]  = useState(false);
  const [moreVisible,  setMoreVisible]  = useState(false);

  const isWeb  = Platform.OS === 'web';
  const role   = user?.role ?? 'staff';
  const allowedTabs = ROLE_TABS[role] ?? ROLE_TABS.staff;

  const visibleRoutes = state.routes.filter((r) => allowedTabs.includes(r.name));
  const moreItems     = getMoreItems(role, logout);

  // ── WEB: top hamburger navigation ──────────────────────────────────────────
  if (isWeb) {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.webTopBar}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
          />
          <TouchableOpacity
            onPress={() => setWebMenuOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            style={styles.webHamburgerButton}
          >
            <Ionicons name="menu" size={26} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {webMenuOpen && (
          <View style={styles.webMenu}>
            {/* Primary tabs */}
            {visibleRoutes.map((route) => {
              const isFocused = state.index === state.routes.indexOf(route);
              const cfg = TAB_ICONS[route.name] ?? { icon: 'help-circle-outline', activeIcon: 'help-circle', label: route.name };
              return (
                <TouchableOpacity
                  key={route.key}
                  style={[styles.webMenuItem, isFocused && styles.webMenuItemActive]}
                  onPress={() => {
                    setWebMenuOpen(false);
                    navigation.navigate(route.name as never);
                  }}
                >
                  <Ionicons
                    name={(isFocused ? cfg.activeIcon : cfg.icon) as IconName}
                    size={20}
                    color={isFocused ? activeColor : Colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.webMenuItemLabel, { color: isFocused ? activeColor : Colors.primary }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Divider */}
            <View style={styles.webDivider} />

            {/* More items */}
            {moreItems.map((item, i) => (
              <TouchableOpacity
                key={`more-${i}`}
                style={[styles.webMenuItem, item.danger && styles.webMenuItemDanger]}
                onPress={() => {
                  setWebMenuOpen(false);
                  if (item.onPress) item.onPress();
                  else if (item.route) navigation.navigate(item.route as never);
                }}
              >
                <Ionicons
                  name={item.icon as IconName}
                  size={20}
                  color={item.danger ? Colors.error : Colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.webMenuItemLabel, item.danger && { color: Colors.error }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── MOBILE: glass pill bottom tab bar ──────────────────────────────────────
  return (
    <>
      <View style={styles.wrapper} pointerEvents="box-none">
        <View
          style={[
            styles.floatingContainer,
            styles.androidShadow,
            { width: Math.min(width - 32, 480) },
          ]}
        >
          <ExpoBlurView tint="light" intensity={90} style={styles.blurShell}>
            <View style={styles.tabBar}>
              {/* Role-based real tabs */}
              {visibleRoutes.map((route) => {
                const isFocused = state.index === state.routes.indexOf(route);
                return (
                  <TabItem
                    key={route.key}
                    route={route}
                    isFocused={isFocused}
                    navigation={navigation}
                  />
                );
              })}

              {/* More button — 5th item */}
              <MoreButton onPress={() => setMoreVisible(true)} />
            </View>
          </ExpoBlurView>
        </View>
      </View>

      <MoreMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        items={moreItems}
      />
    </>
  );
};

// ─── More button ──────────────────────────────────────────────────────────────

function MoreButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="More options"
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.tabButton}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="ellipsis-horizontal" size={22} color={inactiveColor} />
        <Text style={[styles.tabLabel, { color: inactiveColor, opacity: 0.8 }]}>More</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Single tab button with animation ────────────────────────────────────────

type TabItemProps = {
  route: BottomTabBarProps['state']['routes'][number];
  isFocused: boolean;
  navigation: BottomTabBarProps['navigation'];
};

const TabItem: React.FC<TabItemProps> = ({ route, isFocused, navigation }) => {
  const animRef = useRef<Animatable.View & View>(null);
  const cfg = TAB_ICONS[route.name] ?? {
    icon: 'help-circle-outline', activeIcon: 'help-circle', label: route.name, animation: 'bounceIn',
  };

  useEffect(() => {
    if (isFocused && animRef.current) {
      animRef.current.animate(cfg.animation as Animatable.Animation, 600);
    }
  }, [isFocused, cfg.animation]);

  const onPress = () => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate(route.name as never);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.tabButton}
    >
      <Animatable.View ref={animRef} style={styles.iconContainer} useNativeDriver>
        <Ionicons
          name={(isFocused ? cfg.activeIcon : cfg.icon) as IconName}
          size={isFocused ? 28 : 22}
          color={isFocused ? activeColor : inactiveColor}
        />
        <Text
          style={[styles.tabLabel, { color: isFocused ? activeColor : inactiveColor, opacity: isFocused ? 1 : 0.8 }]}
          numberOfLines={1}
        >
          {cfg.label}
        </Text>
      </Animatable.View>
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // mobile glass bar
  wrapper: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  floatingContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  blurShell: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    height: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidShadow: {
    elevation: 18,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  tabButton:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // web top nav
  logo: { width: 140, height: 60, borderRadius: 80, alignSelf: 'center' },
  webWrapper: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60 },
  webTopBar: {
    height: 80,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  webHamburgerButton: { padding: 6, borderRadius: 999 },
  webMenu: {
    position: 'absolute',
    top: 56,
    right: 16,
    minWidth: 200,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  webMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  webMenuItemActive: { backgroundColor: Colors.accentMuted },
  webMenuItemDanger: {},
  webMenuItemLabel: { fontSize: 14, fontWeight: '500' },
  webDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
    marginHorizontal: 10,
  },
});
