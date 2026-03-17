// app/(customer)/home.tsx
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { useAuth } from '@/context/AuthContext';
import { useBookings } from '@/hooks/useBookings';
import type { Booking } from '@/hooks/useBookings';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, SectionHeader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  color: string;
  bg: string;
  route: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const UPCOMING_STATUSES = new Set([
  'pending', 'confirmed', 'assigned', 'in_progress', 'quality_check',
]);

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:       { label: 'Pending',       color: Colors.warning,  bg: Colors.warningBg  },
  confirmed:     { label: 'Confirmed',     color: Colors.accent,   bg: Colors.accentMuted },
  assigned:      { label: 'Assigned',      color: Colors.info,     bg: Colors.infoBg     },
  in_progress:   { label: 'In Progress',   color: Colors.accent,   bg: Colors.accentMuted },
  quality_check: { label: 'Quality Check', color: Colors.warning,  bg: Colors.warningBg  },
  completed:     { label: 'Completed',     color: Colors.success,  bg: Colors.successBg  },
  finished:      { label: 'Finished',      color: Colors.success,  bg: Colors.successBg  },
  cancelled:     { label: 'Cancelled',     color: Colors.error,    bg: Colors.errorBg    },
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon:  'sparkles-outline',
    label: 'Book a Wash',
    sub:   'Schedule a service',
    color: Colors.accent,
    bg:    Colors.accentMuted,
    route: '/(customer)/book',
  },
  {
    icon:  'calendar-outline',
    label: 'My Bookings',
    sub:   'History & upcoming',
    color: Colors.info,
    bg:    Colors.infoBg,
    route: '/(customer)/booking',
  },
  {
    icon:  'gift-outline',
    label: 'My Rewards',
    sub:   'Points & milestones',
    color: Colors.warning,
    bg:    Colors.warningBg,
    route: '/(customer)/loyalty',
  },
  {
    icon:  'car-outline',
    label: 'My Vehicles',
    sub:   'Manage saved cars',
    color: Colors.success,
    bg:    Colors.successBg,
    route: '/(customer)/vehicles',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceLabel(b: Booking) {
  return b.packageName ?? b.serviceType ?? 'Car Wash';
}

function haptic() {
  if (IS_IOS) Haptics.selectionAsync();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: Colors.surfaceAlt },
        style,
      ]}
    />
  );
}

function NextBookingSkeleton() {
  return (
    <View style={[s.nextCard, { borderLeftColor: Colors.border }]}>
      <SkeletonBlock width="65%" height={16} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="45%" height={12} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="28%" height={22} radius={12} />
    </View>
  );
}

function ActivitySkeletonList() {
  return (
    <View style={s.activityList}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[s.activityCard, { gap: 8 }]}>
          <SkeletonBlock width="55%" height={14} />
          <SkeletonBlock width="38%" height={11} />
        </View>
      ))}
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CustomerHome() {
  const { user } = useAuth();
  const router   = useRouter();

  const { bookings, loading, refresh } = useBookings();

  // Silent refresh every time the screen comes into focus
  useFocusEffect(
    useCallback(() => { refresh(false); }, [refresh]),
  );

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  // Soonest upcoming (non-completed, non-cancelled) booking
  const nextBooking = useMemo<Booking | null>(() => {
    const upcoming = bookings
      .filter(b => UPCOMING_STATUSES.has(b.status))
      .sort((a, b) => {
        const da = new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`);
        const db = new Date(`${b.appointmentDate}T${b.appointmentTime || '00:00'}`);
        return da.getTime() - db.getTime();
      });
    return upcoming[0] ?? null;
  }, [bookings]);

  // 3 most recent bookings for the activity feed
  const recentBookings = useMemo(() => bookings.slice(0, 3), [bookings]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.greeting}>{greeting},</Text>
              <Text style={s.userName}>{firstName}</Text>
            </View>

            <View style={s.headerRight}>
              {/* Notification bell */}
              <Pressable
                style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
                android_ripple={{ color: Colors.accent + '20', borderless: true }}
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
              </Pressable>

              {/* Avatar → settings */}
              <Pressable
                style={({ pressed }) => [s.avatarBtn, pressed && { opacity: 0.8 }]}
                onPress={() => { haptic(); router.push('/(customer)/settings'); }}
                hitSlop={8}
                android_ripple={{ color: Colors.accent + '20', borderless: true }}
              >
                <Avatar name={firstName} size={42} />
              </Pressable>
            </View>
          </View>

          {/* ── Next Booking card ───────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            {loading ? (
              <NextBookingSkeleton />
            ) : nextBooking ? (
              <View style={s.nextCard}>
                {/* accent left border rendered as a sibling absolutely-positioned view */}
                <View style={s.nextBorder} />

                <View style={s.nextTop}>
                  <View style={s.nextInfo}>
                    <Text style={s.nextLabel} numberOfLines={1}>
                      {serviceLabel(nextBooking)}
                    </Text>
                    <Text style={s.nextMeta}>
                      {nextBooking.appointmentDate}
                      {nextBooking.appointmentTime ? ` · ${nextBooking.appointmentTime}` : ''}
                    </Text>
                  </View>
                  <StatusBadge status={nextBooking.status} />
                </View>

                <Pressable
                  style={({ pressed }) => [s.trackBtn, pressed && { opacity: 0.82 }]}
                  onPress={() => {
                    haptic();
                    router.push(`/(customer)/track/${nextBooking._id}` as any);
                  }}
                  android_ripple={{ color: Colors.accentDark + '20', borderless: false }}
                >
                  <Ionicons name="navigate-outline" size={14} color={Colors.white} />
                  <Text style={s.trackBtnText}>Track</Text>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>

          {/* ── Quick Actions ───────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
          </Animated.View>

          <View style={s.grid}>
            {QUICK_ACTIONS.map((action, index) => (
              <Animated.View
                key={action.route}
                entering={FadeInDown.delay(200 + index * 60).duration(300)}
                style={s.gridCell}
              >
                <Pressable
                  style={({ pressed }) => [s.gridCard, pressed && { opacity: 0.88 }]}
                  onPress={() => { haptic(); router.push(action.route as any); }}
                  android_ripple={{ color: Colors.accent + '12', borderless: false }}
                >
                  <View style={[s.gridIcon, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text style={s.gridLabel}>{action.label}</Text>
                  <Text style={s.gridSub}>{action.sub}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* ── Recent Activity ─────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(440).duration(300)}>
            <SectionHeader
              title="Recent Activity"
              actionLabel="See All"
              onAction={() => router.push('/(customer)/booking')}
            />
          </Animated.View>

          {loading ? (
            <ActivitySkeletonList />
          ) : recentBookings.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(480).duration(300)} style={s.emptyWrap}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
              <Text style={s.emptyText}>No bookings yet — tap Book a Wash to get started.</Text>
            </Animated.View>
          ) : (
            <View style={s.activityList}>
              {recentBookings.map((b, i) => (
                <Animated.View key={b._id} entering={FadeInDown.delay(480 + i * 60).duration(300)}>
                  <Pressable
                    style={({ pressed }) => [s.activityCard, pressed && { opacity: 0.9 }]}
                    onPress={() =>
                      router.push({
                        pathname: '/(customer)/booking/[id]',
                        params: { id: b._id },
                      })
                    }
                    android_ripple={{ color: Colors.accent + '12', borderless: false }}
                  >
                    <View style={s.activityLeft}>
                      <Text style={s.activityService} numberOfLines={1}>
                        {serviceLabel(b)}
                      </Text>
                      <Text style={s.activityMeta}>
                        {b.appointmentDate}
                        {b.appointmentTime ? ` · ${b.appointmentTime}` : ''}
                      </Text>
                    </View>

                    <View style={s.activityRight}>
                      <StatusBadge status={b.status} />
                      {b.totalPrice != null && (
                        <Text style={s.activityPrice}>
                          ${(b.finalPrice ?? b.totalPrice).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: SCROLL_PADDING_BOTTOM,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerText:  { flex: 1 },
  greeting:    { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  userName:    { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarBtn:   { borderRadius: 22 },

  // ── Next Booking
  nextCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
    ...cardShadow,
  },
  nextBorder: {}, // left border applied directly on nextCard
  nextTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  nextInfo:   { flex: 1, marginRight: 10 },
  nextLabel:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  nextMeta:   { fontSize: 14, color: Colors.textSecondary },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // ── Quick Actions
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  gridCell:     { width: '47%' },
  gridCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  gridIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  gridSub:   { fontSize: 12, color: Colors.textSecondary },

  // ── Status badge
  badge:     { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // ── Recent Activity
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  activityList: { gap: 10, marginBottom: 8 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  activityLeft:    { flex: 1, marginRight: 10 },
  activityService: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  activityMeta:    { fontSize: 12, color: Colors.textMuted },
  activityRight:   { alignItems: 'flex-end', gap: 4 },
  activityPrice:   { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
});
