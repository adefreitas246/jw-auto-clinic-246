// app/(tabs)/reviews.tsx
// Admin reviews dashboard — overall rating, per-technician breakdown, review list.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { SCREEN_PADDING, borderRadius, cardShadow } from '@/utils/platformStyles';
import { ScreenHeader, Avatar, Badge } from '@/components/ui';

type TechStats = {
  staffId:      string | null;
  staffName:    string;
  avgStars:     number;
  totalReviews: number;
  distribution: Record<string, number>;
};

type StatsData = {
  overall:      { avgStars: number; totalReviews: number };
  byTechnician: TechStats[];
};

type Review = {
  _id:            string;
  stars:          number;
  comment:        string;
  staffName:      string;
  adminReply:     string;
  adminRepliedAt: string | null;
  isPublic:       boolean;
  createdAt:      string;
  userId:         { name: string; email: string } | null;
};

type FilterTab = 'all' | 'positive' | 'negative' | 'pending';

function StarRow({ avg, size = 14 }: { avg: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons
          key={s}
          name={s <= Math.round(avg) ? 'star' : s - 0.5 <= avg ? 'star-half' : 'star-outline'}
          size={size}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

// Filter tabs
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'positive', label: 'Positive' },
  { key: 'negative', label: 'Negative' },
  { key: 'pending',  label: 'Pending' },
];

export default function ReviewsScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [stats,      setStats]      = useState<StatsData | null>(null);
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [tab,         setTab]         = useState<'overview' | 'reviews'>('overview');
  const [filterTab,   setFilterTab]   = useState<FilterTab>('all');

  const headers = { Authorization: `Bearer ${token}` };

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get<StatsData>('/api/reviews/stats', { headers });
      setStats(res.data);
    } catch {}
  }, [token]);

  const loadReviews = useCallback(async (pg = 1, append = false) => {
    try {
      const res = await axios.get<{ reviews: Review[]; total: number; pages: number }>(
        `/api/reviews?page=${pg}&limit=20`, { headers }
      );
      setReviews(prev => append ? [...prev, ...res.data.reviews] : res.data.reviews);
      setHasMore(pg < res.data.pages);
      setPage(pg);
    } catch {}
  }, [token]);

  const load = useCallback(async () => {
    await Promise.all([loadStats(), loadReviews(1, false)]);
    setLoading(false);
    setRefreshing(false);
  }, [loadStats, loadReviews]);

  useEffect(() => { load(); }, [load]);

  async function handleReply() {
    if (!replyText.trim() || !replyTarget) return;
    try {
      setSubmitting(true);
      await axios.patch(`/api/reviews/${replyTarget._id}/reply`, { reply: replyText }, { headers });
      Alert.alert('Reply saved!');
      setReplyTarget(null);
      setReplyText('');
      loadReviews(1, false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Failed to save reply.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHide(review: Review) {
    Alert.alert(
      'Hide Review',
      'This will make the review non-public. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/api/reviews/${review._id}`, { headers });
              loadReviews(1, false);
            } catch {}
          },
        },
      ]
    );
  }

  // Filter reviews
  const filteredReviews = reviews.filter(r => {
    if (filterTab === 'positive') return r.stars >= 4;
    if (filterTab === 'negative') return r.stars <= 2;
    if (filterTab === 'pending')  return !r.adminReply;
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={st.center} edges={['top']}>
        <Text style={st.muted}>Loading reviews…</Text>
      </SafeAreaView>
    );
  }

  const overall = stats?.overall ?? { avgStars: 0, totalReviews: 0 };

  // Star distribution for summary card
  const allDist: Record<number, number> = {};
  reviews.forEach(r => {
    allDist[r.stars] = (allDist[r.stars] ?? 0) + 1;
  });

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScreenHeader title="Reviews" />

      {/* Tabs */}
      <View style={st.tabRow}>
        {(['overview', 'reviews'] as const).map(t => (
          <Pressable
            key={t}
            style={[st.tabBtn, tab === t && st.tabBtnActive]}
            onPress={() => setTab(t)}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={[st.tabBtnText, tab === t && st.tabBtnTextActive]}>
              {t === 'overview' ? 'Overview' : 'All Reviews'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' ? (
        <ScrollView
          contentContainerStyle={st.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Rating summary Card */}
          <ReAnimated.View entering={FadeIn.duration(300)} style={st.ratingCard}>
            <View style={st.ratingLeft}>
              <Text style={st.ratingBig}>{overall.avgStars.toFixed(1)}</Text>
              <StarRow avg={overall.avgStars} size={18} />
              <Text style={st.ratingTotal}>{overall.totalReviews} reviews</Text>
            </View>
            <View style={st.starBars}>
              {[5, 4, 3, 2, 1].map(s => {
                const count = allDist[s] ?? 0;
                const pct   = overall.totalReviews > 0 ? count / overall.totalReviews : 0;
                return (
                  <View key={s} style={st.starBarRow}>
                    <Text style={st.starBarLabel}>{s}★</Text>
                    <View style={st.starBarTrack}>
                      <View style={[st.starBarFill, { width: `${Math.round(pct * 100)}%` }]} />
                    </View>
                    <Text style={st.starBarCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </ReAnimated.View>

          {/* Per-technician */}
          <Text style={st.sectionTitle}>By Technician</Text>
          {(stats?.byTechnician ?? []).length === 0 ? (
            <Text style={st.empty}>No technician data yet.</Text>
          ) : (
            stats!.byTechnician.map((t, i) => (
              <ReAnimated.View
                key={t.staffId ?? i}
                entering={FadeInDown.delay(i * 60).springify()}
                style={st.techCard}
              >
                <View style={st.techTop}>
                  <Avatar name={t.staffName || 'U'} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.techName}>{t.staffName || 'Unassigned'}</Text>
                    <StarRow avg={t.avgStars} />
                  </View>
                  <View style={st.techRight}>
                    <Text style={st.techAvg}>{t.avgStars.toFixed(1)}</Text>
                    <Text style={st.techCount}>{t.totalReviews} reviews</Text>
                  </View>
                </View>
                {/* Distribution bars */}
                <View style={st.distRow}>
                  {[5, 4, 3, 2, 1].map(s => {
                    const count = t.distribution[s] ?? 0;
                    const pct   = t.totalReviews > 0 ? count / t.totalReviews : 0;
                    return (
                      <View key={s} style={st.distLine}>
                        <Text style={st.distStar}>{s}★</Text>
                        <View style={st.distTrack}>
                          <View style={[st.distFill, { width: `${Math.round(pct * 100)}%` }]} />
                        </View>
                        <Text style={st.distCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </ReAnimated.View>
            ))
          )}
        </ScrollView>
      ) : (
        <>
          {/* Filter chips */}
          <View style={st.filterChipsRow}>
            {FILTER_TABS.map(ft => (
              <Pressable
                key={ft.key}
                style={[st.filterChip, filterTab === ft.key && st.filterChipActive]}
                onPress={() => setFilterTab(ft.key)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <Text style={[st.filterChipText, filterTab === ft.key && st.filterChipTextActive]}>
                  {ft.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={filteredReviews}
            keyExtractor={r => r._id}
            contentContainerStyle={st.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
            onEndReached={() => hasMore && loadReviews(page + 1, true)}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={<Text style={st.empty}>No reviews yet.</Text>}
            renderItem={({ item: r, index }) => (
              <ReAnimated.View entering={FadeInDown.delay(index * 50).springify()}>
                <View style={[st.reviewCard, !r.isPublic && { opacity: 0.5 }]}>
                  {/* Top row: avatar + name + stars + date */}
                  <View style={st.reviewTop}>
                    <Avatar name={r.userId?.name ?? 'Customer'} size={40} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={st.reviewUser}>{r.userId?.name ?? 'Customer'}</Text>
                      <StarRow avg={r.stars} />
                    </View>
                    <Text style={st.reviewDate}>
                      {new Date(r.createdAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>

                  {/* Review text */}
                  {r.comment ? (
                    <Text style={st.reviewComment} numberOfLines={3}>{r.comment}</Text>
                  ) : null}

                  {/* Admin reply */}
                  {r.adminReply ? (
                    <View style={st.replyBox}>
                      <Text style={st.replyLabel}>Admin Reply:</Text>
                      <Text style={st.replyText}>{r.adminReply}</Text>
                    </View>
                  ) : null}

                  {/* Bottom: service badge + actions */}
                  <View style={st.reviewBottom}>
                    {r.staffName ? (
                      <Badge status="info" label={r.staffName} size="sm" />
                    ) : <View />}
                    <View style={st.reviewActions}>
                      <Pressable
                        style={st.replyBtn}
                        onPress={() => { setReplyTarget(r); setReplyText(r.adminReply ?? ''); }}
                        android_ripple={{ color: Colors.accent + '20', borderless: false }}
                      >
                        <Ionicons name="chatbubble-outline" size={13} color={Colors.accent} />
                        <Text style={st.replyBtnText}>{r.adminReply ? 'Edit Reply' : 'Reply'}</Text>
                      </Pressable>
                      {r.isPublic && (
                        <Pressable
                          style={st.hideBtn}
                          onPress={() => handleHide(r)}
                          android_ripple={{ color: Colors.border, borderless: false }}
                        >
                          <Ionicons name="eye-off-outline" size={13} color={Colors.textMuted} />
                          <Text style={st.hideBtnText}>Hide</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              </ReAnimated.View>
            )}
          />
        </>
      )}

      {/* Reply modal */}
      <Modal visible={!!replyTarget} transparent animationType="slide" onRequestClose={() => setReplyTarget(null)}>
        <Pressable style={st.backdrop} onPress={() => setReplyTarget(null)} />
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>Reply to Review</Text>
          <TextInput
            style={st.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type your reply…"
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          <View style={st.sheetBtns}>
            <Pressable style={st.sheetCancel} onPress={() => setReplyTarget(null)}>
              <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[st.sheetConfirm, submitting && { opacity: 0.6 }]}
              onPress={handleReply}
              disabled={submitting}
            >
              <Text style={{ color: Colors.white, fontWeight: '700' }}>{submitting ? 'Saving…' : 'Save Reply'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SCREEN_PADDING, paddingBottom: 100 },
  muted:  { color: Colors.textMuted, fontSize: 14 },
  empty:  { color: Colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: SCREEN_PADDING,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    overflow: 'hidden',
  },
  tabBtnActive:     { borderBottomColor: Colors.accent },
  tabBtnText:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.accent },

  // Rating summary card
  ratingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl, padding: 20,
    marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  ratingLeft: { alignItems: 'center', gap: 6 },
  ratingBig: {
    fontSize: 48, fontWeight: '800', color: Colors.accent, lineHeight: 52,
  },
  ratingTotal: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Star bars
  starBars:   { flex: 1, gap: 4 },
  starBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starBarLabel: { width: 22, fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },
  starBarTrack: {
    flex: 1, height: 6, backgroundColor: Colors.accentMuted,
    borderRadius: 3, overflow: 'hidden',
  },
  starBarFill:  { height: 6, backgroundColor: Colors.accent, borderRadius: 3 },
  starBarCount: { width: 22, fontSize: 11, color: Colors.textSecondary },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },

  // Technician card
  techCard: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  techTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  techName:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  techRight:  { alignItems: 'flex-end' },
  techAvg:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  techCount:  { fontSize: 11, color: Colors.textMuted },
  distRow:    { gap: 3 },
  distLine:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distStar:   { width: 22, fontSize: 11, color: Colors.textSecondary, textAlign: 'right' },
  distTrack:  { flex: 1, height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  distFill:   { height: 6, backgroundColor: Colors.warning, borderRadius: 3 },
  distCount:  { width: 22, fontSize: 11, color: Colors.textSecondary },

  // Filter chips
  filterChipsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterChip: {
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  filterChipActive:    { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  filterChipText:      { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterChipTextActive:{ color: Colors.accent },

  // Review cards
  reviewCard: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  reviewTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  reviewUser:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  reviewDate:    { fontSize: 11, color: Colors.textMuted },
  reviewComment: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  replyBox:      { backgroundColor: Colors.accentMuted, borderRadius: 8, padding: 10, marginBottom: 10 },
  replyLabel:    { fontSize: 11, fontWeight: '700', color: Colors.accent, marginBottom: 3 },
  replyText:     { fontSize: 12, color: Colors.textSecondary },

  reviewBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  reviewActions: { flexDirection: 'row', gap: 8 },
  replyBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: borderRadius.sm, backgroundColor: Colors.accentMuted, overflow: 'hidden',
  },
  replyBtnText: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  hideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: borderRadius.sm, backgroundColor: Colors.surfaceAlt, overflow: 'hidden',
  },
  hideBtnText: { fontSize: 12, color: Colors.textMuted },

  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  replyInput:   { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.textPrimary, minHeight: 100, marginBottom: 16 },
  sheetBtns:    { flexDirection: 'row', gap: 12 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center' },
});
