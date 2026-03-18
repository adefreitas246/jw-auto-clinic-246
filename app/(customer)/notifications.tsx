// app/(customer)/notifications.tsx
// Customer notification centre — fetches GET /api/notifications.
// Gracefully shows empty state if the endpoint is not yet live.
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType = 'booking' | 'loyalty' | 'payment' | 'promo' | 'system';

type Notification = {
  _id:       string;
  title:     string;
  body:      string;
  type:      NotifType;
  read:      boolean;
  createdAt: string;
  meta?: {
    bookingId?: string;
  };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotifType, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
}> = {
  booking: { icon: 'calendar-outline',         color: Colors.accent,   bg: Colors.accentMuted },
  loyalty: { icon: 'star-outline',             color: Colors.warning,  bg: Colors.warningBg   },
  payment: { icon: 'card-outline',             color: Colors.success,  bg: Colors.successBg   },
  promo:   { icon: 'pricetag-outline',         color: Colors.info,     bg: Colors.infoBg      },
  system:  { icon: 'information-circle-outline', color: Colors.chromeDark, bg: Colors.surfaceAlt },
};

const DEFAULT_TYPE = TYPE_CONFIG.system;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(250)}>
      <View style={s.row}>
        <View style={[s.iconWrap, { backgroundColor: Colors.surfaceAlt }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 13, width: '60%', borderRadius: 6, backgroundColor: Colors.surfaceAlt }} />
          <View style={{ height: 11, width: '80%', borderRadius: 6, backgroundColor: Colors.surfaceAlt }} />
        </View>
      </View>
    </Animated.View>
  );
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ notif, index, onPress }: { notif: Notification; index: number; onPress: () => void }) {
  const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_TYPE;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(260)}>
      <Pressable
        style={({ pressed }) => [
          s.row,
          !notif.read && s.rowUnread,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onPress}
        android_ripple={{ color: Colors.accent + '15', borderless: false }}
      >
        <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
          {!notif.read && <View style={s.unreadDot} />}
        </View>

        <View style={s.rowContent}>
          <View style={s.rowTop}>
            <Text style={[s.title, !notif.read && s.titleUnread]} numberOfLines={1}>
              {notif.title}
            </Text>
            <Text style={s.time}>{timeAgo(notif.createdAt)}</Text>
          </View>
          <Text style={s.body} numberOfLines={2}>{notif.body}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get<Notification[]>('/api/notifications');
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch {
      // endpoint may not exist yet — show empty state gracefully
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time the screen comes into focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = () => { setRefreshing(true); load(true); };

  const handleNotifPress = async (notif: Notification) => {
    // Mark read optimistically
    setNotifications(prev =>
      prev.map(n => n._id === notif._id ? { ...n, read: true } : n),
    );
    setUnreadCount(prev => Math.max(0, prev - (notif.read ? 0 : 1)));

    // Fire-and-forget
    axios.patch(`/api/notifications/${notif._id}/read`).catch(() => {});

    // Navigate if there's a linked booking
    if (notif.meta?.bookingId) {
      router.push({
        pathname: '/(customer)/booking/[id]',
        params: { id: notif.meta.bookingId },
      });
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    axios.post('/api/notifications/read-all').catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        backButton
        rightAction={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAllRead}
              hitSlop={8}
              android_ripple={{ color: Colors.accent + '20', borderless: true }}
            >
              <Text style={s.markAllText}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        <Animated.View entering={FadeIn.duration(250)}>
          {loading ? (
            /* Skeleton */
            <View style={s.card}>
              {[0, 1, 2, 3].map(i => (
                <React.Fragment key={i}>
                  <SkeletonRow delay={i * 60} />
                  {i < 3 && <View style={s.sep} />}
                </React.Fragment>
              ))}
            </View>
          ) : notifications.length === 0 ? (
            /* Empty state */
            <Animated.View entering={FadeInDown.delay(80).duration(300)} style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="notifications-off-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>All caught up</Text>
              <Text style={s.emptyText}>
                You have no notifications yet. We will let you know when something happens.
              </Text>
            </Animated.View>
          ) : (
            /* Notification list */
            <View style={s.card}>
              {notifications.map((notif, i) => (
                <React.Fragment key={notif._id}>
                  <NotifRow
                    notif={notif}
                    index={i}
                    onPress={() => handleNotifPress(notif)}
                  />
                  {i < notifications.length - 1 && <View style={s.sep} />}
                </React.Fragment>
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
  content: { padding: SCREEN_PADDING, paddingBottom: SCROLL_PADDING_BOTTOM },

  markAllText: { fontSize: 13, fontWeight: '600', color: Colors.accent },

  // Card container
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
    backgroundColor: Colors.surface,
  },
  rowUnread: { backgroundColor: Colors.accentMuted },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  rowContent: { flex: 1 },
  rowTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  title:      { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  titleUnread:{ fontWeight: '700' },
  time:       { fontSize: 11, color: Colors.textMuted, flexShrink: 0, marginTop: 1 },
  body:       { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Empty state
  emptyWrap:     { alignItems: 'center', paddingVertical: 64 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
});
