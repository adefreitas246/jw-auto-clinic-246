import React, { useState } from 'react';
import {
  View, Pressable, StyleSheet, Platform,
  Text, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';

const TAB_HEIGHT = 60;

// ─── Single tab button — hooks live here, not in the map ──────────────────────

type TabItemProps = {
  route: BottomTabBarProps['state']['routes'][number];
  isFocused: boolean;
  options: BottomTabBarProps['descriptors'][string]['options'];
  onPress: () => void;
};

function TabItem({ route, isFocused, options, onPress }: TabItemProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconName =
    (options as any).tabBarIcon?.({ focused: isFocused, color: '', size: 24 })
      ?.props?.name ?? 'ellipsis-horizontal';

  const label = options.title ?? route.name;

  const handlePress = () => {
    scale.value = withSpring(1.2, {}, () => {
      scale.value = withSpring(1);
    });
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      key={route.key}
      onPress={handlePress}
      android_ripple={{ color: Colors.accentMuted, borderless: false }}
      style={styles.tab}
    >
      <Animated.View
        style={[
          styles.tabContent,
          isFocused && styles.tabActive,
          animStyle,
        ]}
      >
        <Ionicons
          name={iconName}
          size={22}
          color={isFocused ? Colors.accent : Colors.textMuted}
        />
        <Text style={[styles.label, { color: isFocused ? Colors.accent : Colors.textMuted }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [moreVisible, setMoreVisible] = useState(false);
  const totalHeight = TAB_HEIGHT + insets.bottom;

  return (
    <>
      <View style={[styles.container, { height: totalHeight }]}>
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={90}
            tint="systemUltraThinMaterial"
            style={StyleSheet.absoluteFill}
          />
        )}
        {Platform.OS === 'android' && (
          <View style={[StyleSheet.absoluteFill, styles.androidBg]} />
        )}
        <View style={styles.topBorder} />
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const isMore = route.name === 'more' || options.title === 'More';

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                options={options}
                onPress={() => {
                  if (isMore) {
                    setMoreVisible(true);
                    return;
                  }
                  if (!isFocused) navigation.navigate(route.name);
                }}
              />
            );
          })}
        </View>
        <View style={{ height: insets.bottom }} />
      </View>

      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.moreSheet}>
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={95}
              tint="systemMaterial"
              style={StyleSheet.absoluteFill}
            />
          )}
          {Platform.OS === 'android' && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surface }]} />
          )}
          <View style={styles.dragHandle} />
          <Text style={styles.moreTitle}>More</Text>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  androidBg: {
    backgroundColor: Colors.surface,
    elevation: 8,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 0.5 : 1,
    backgroundColor: Platform.OS === 'ios'
      ? 'rgba(200,200,200,0.3)'
      : Colors.border,
  },
  tabRow: {
    flexDirection: 'row',
    height: TAB_HEIGHT,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_HEIGHT,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
  },
  tabActive: {
    backgroundColor: Platform.OS === 'ios'
      ? 'rgba(14,165,233,0.10)'
      : 'transparent',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  moreSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 300,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  moreTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
