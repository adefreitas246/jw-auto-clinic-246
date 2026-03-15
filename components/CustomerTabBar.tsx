// components/CustomerTabBar.tsx
// Glass pill tab bar for the customer app.
// Shows 4 tabs (home, catalog, vehicles, loyalty) + a "More" button opening MoreMenu.
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { MoreMenu, MoreMenuItem } from './MoreMenu';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Config ───────────────────────────────────────────────────────────────────

const TAB_CONFIG: Record<string, { icon: IconName; activeIcon: IconName; label: string; animation: string }> = {
  home:      { icon: 'home-outline',         activeIcon: 'home',            label: 'Home',       animation: 'wiggle'     },
  catalog:   { icon: 'layers-outline',        activeIcon: 'layers',          label: 'Browse',     animation: 'pulse'      },
  vehicles:  { icon: 'car-outline',           activeIcon: 'car',             label: 'Vehicles',   animation: 'rubberBand' },
  loyalty:   { icon: 'star-outline',          activeIcon: 'star',            label: 'Rewards',    animation: 'pulse'      },
};

const VISIBLE_TABS = ['home', 'catalog', 'vehicles', 'loyalty'];

const ACTIVE   = '#6a0dad';
const INACTIVE = '#444';

const MORE_ITEMS: MoreMenuItem[] = [
  { label: 'Bookings',       icon: 'calendar-outline',      route: '/(customer)/book'           },
  { label: 'Subscriptions',  icon: 'card-outline',          route: '/(customer)/subscriptions'  },
  { label: 'Referrals',      icon: 'gift-outline',          route: '/(customer)/referral'       },
  { label: 'Rate a Service', icon: 'star-half-outline',     route: '/(customer)/rate'           },
];

// ─── Single tab button ────────────────────────────────────────────────────────

type TabItemProps = {
  route: BottomTabBarProps['state']['routes'][number];
  isFocused: boolean;
  navigation: BottomTabBarProps['navigation'];
};

function TabItem({ route, isFocused, navigation }: TabItemProps) {
  const animRef = useRef<Animatable.View & View>(null);
  const cfg = TAB_CONFIG[route.name] ?? {
    icon: 'help-circle-outline', activeIcon: 'help-circle', label: route.name, animation: 'bounceIn',
  };

  useEffect(() => {
    if (isFocused) animRef.current?.animate(cfg.animation as Animatable.Animation, 600);
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
      style={s.tabButton}
    >
      <Animatable.View ref={animRef} style={s.iconContainer} useNativeDriver>
        <Ionicons
          name={isFocused ? cfg.activeIcon : cfg.icon}
          size={isFocused ? 26 : 22}
          color={isFocused ? ACTIVE : INACTIVE}
        />
        <Text style={[s.label, { color: isFocused ? ACTIVE : INACTIVE, opacity: isFocused ? 1 : 0.75 }]}>
          {cfg.label}
        </Text>
      </Animatable.View>
    </TouchableOpacity>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

export function CustomerTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const { logout } = useAuth();
  const [moreVisible, setMoreVisible] = useState(false);

  const visibleRoutes = state.routes.filter((r) => VISIBLE_TABS.includes(r.name));

  const moreItems: MoreMenuItem[] = [
    ...MORE_ITEMS,
    { label: 'Log Out', icon: 'log-out-outline', onPress: logout, danger: true },
  ];

  return (
    <>
      <View style={s.wrapper} pointerEvents="box-none">
        <View style={[s.floatingContainer, { width: Math.min(width - 32, 440) }]}>
          <BlurView tint="light" intensity={90} style={s.blurShell}>
            <View style={s.tabBar}>
              {visibleRoutes.map((route) => (
                <TabItem
                  key={route.key}
                  route={route}
                  isFocused={state.index === state.routes.indexOf(route)}
                  navigation={navigation}
                />
              ))}

              {/* More button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="More options"
                onPress={() => setMoreVisible(true)}
                activeOpacity={0.85}
                style={s.tabButton}
              >
                <View style={s.iconContainer}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={INACTIVE} />
                  <Text style={[s.label, { color: INACTIVE, opacity: 0.8 }]}>More</Text>
                </View>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>

      <MoreMenu
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        items={moreItems}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
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
    height: 70,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
