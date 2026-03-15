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

function StarRow({ avg, size = 14 }: { avg: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons
          key={s}
          name={s <= Math.round(avg) ? 'star' : s - 0.5 <= avg ? 'star-half' : 'star-outline'}
          size={size}
          color="#f59e0b"
        />
      ))}
    </View>
  );
}

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

  if (loading) {
    return (
      <SafeAreaView style={st.center}>
        <Text style={st.muted}>Loading reviews…</Text>
      </SafeAreaView>
    );
  }

  const overall = stats?.overall ?? { avgStars: 0, totalReviews: 0 };

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={st.headerTitle}>Reviews</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={st.tabRow}>
        {(['overview', 'reviews'] as const).map(t => (
          <Pressable key={t} style={[st.tabBtn, tab === t && st.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[st.tabBtnText, tab === t && st.tabBtnTextActive]}>
              {t === 'overview' ? 'Overview' : 'All Reviews'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' ? (
        <ScrollView
          contentContainerStyle={st.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Overall card */}
          <View style={st.overallCard}>
            <Text style={st.overallNum}>{overall.avgStars.toFixed(1)}</Text>
            <StarRow avg={overall.avgStars} size={22} />
            <Text style={st.overallTotal}>{overall.totalReviews} reviews total</Text>
          </View>

          {/* Per-technician */}
          <Text style={st.sectionTitle}>By Technician</Text>
          {(stats?.byTechnician ?? []).length === 0 ? (
            <Text style={st.empty}>No technician data yet.</Text>
          ) : (
            stats!.byTechnician.map((t, i) => (
              <View key={t.staffId ?? i} style={st.techCard}>
                <View style={st.techTop}>
                  <View style={st.techAvatar}>
                    <Text style={st.techAvatarText}>{(t.staffName || 'U')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.techName}>{t.staffName || 'Unassigned'}</Text>
                    <StarRow avg={t.avgStars} />
                  </View>
                  <View style={st.techRight}>
                    <Text style={st.techAvg}>{t.avgStars.toFixed(1)}</Text>
                    <Text style={st.techCount}>{t.totalReviews} reviews</Text>
                  </View>
                </View>
                {/* Distribution bar */}
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
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={r => r._id}
          contentContainerStyle={st.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
          onEndReached={() => hasMore && loadReviews(page + 1, true)}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={st.empty}>No reviews yet.</Text>}
          renderItem={({ item: r }) => (
            <View style={[st.reviewCard, !r.isPublic && { opacity: 0.5 }]}>
              <View style={st.reviewTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.reviewUser}>{r.userId?.name ?? 'Customer'}</Text>
                  <StarRow avg={r.stars} />
                </View>
                <Text style={st.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              {r.staffName ? <Text style={st.techTag}>Technician: {r.staffName}</Text> : null}
              {r.comment ? <Text style={st.reviewComment}>{r.comment}</Text> : null}
              {r.adminReply ? (
                <View style={st.replyBox}>
                  <Text style={st.replyLabel}>Admin Reply:</Text>
                  <Text style={st.replyText}>{r.adminReply}</Text>
                </View>
              ) : null}
              <View style={st.reviewActions}>
                <Pressable style={st.replyBtn} onPress={() => { setReplyTarget(r); setReplyText(r.adminReply ?? ''); }}>
                  <Ionicons name="chatbubble-outline" size={13} color="#6a0dad" />
                  <Text style={st.replyBtnText}>{r.adminReply ? 'Edit Reply' : 'Reply'}</Text>
                </Pressable>
                {r.isPublic && (
                  <Pressable style={st.hideBtn} onPress={() => handleHide(r)}>
                    <Ionicons name="eye-off-outline" size={13} color="#9ca3af" />
                    <Text style={st.hideBtnText}>Hide</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
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
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />
          <View style={st.sheetBtns}>
            <Pressable style={st.sheetCancel} onPress={() => setReplyTarget(null)}>
              <Text style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[st.sheetConfirm, submitting && { opacity: 0.6 }]}
              onPress={handleReply}
              disabled={submitting}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting ? 'Saving…' : 'Save Reply'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  muted:  { color: '#9ca3af', fontSize: 14 },
  empty:  { color: '#9ca3af', textAlign: 'center', marginTop: 20, fontSize: 14 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },

  tabRow:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 16 },
  tabBtn:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: '#6a0dad' },
  tabBtnText:     { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#6a0dad' },

  overallCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  overallNum:   { fontSize: 56, fontWeight: '900', color: '#1f2937', lineHeight: 60 },
  overallTotal: { fontSize: 13, color: '#9ca3af', marginTop: 8 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 10 },

  techCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  techTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  techAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f0ff', justifyContent: 'center', alignItems: 'center' },
  techAvatarText: { fontSize: 16, fontWeight: '700', color: '#6a0dad' },
  techName:   { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 3 },
  techRight:  { alignItems: 'flex-end' },
  techAvg:    { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  techCount:  { fontSize: 11, color: '#9ca3af' },
  distRow:    { gap: 3 },
  distLine:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distStar:   { width: 22, fontSize: 11, color: '#6b7280', textAlign: 'right' },
  distTrack:  { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  distFill:   { height: 6, backgroundColor: '#f59e0b', borderRadius: 3 },
  distCount:  { width: 22, fontSize: 11, color: '#6b7280' },

  reviewCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  reviewTop:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  reviewUser:    { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  reviewDate:    { fontSize: 11, color: '#9ca3af' },
  techTag:       { fontSize: 11, color: '#6b7280', marginBottom: 6 },
  reviewComment: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  replyBox:      { backgroundColor: '#f5f0ff', borderRadius: 8, padding: 10, marginBottom: 8 },
  replyLabel:    { fontSize: 11, fontWeight: '700', color: '#6a0dad', marginBottom: 3 },
  replyText:     { fontSize: 12, color: '#374151' },
  reviewActions: { flexDirection: 'row', gap: 10 },
  replyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#f5f0ff' },
  replyBtnText:  { fontSize: 12, color: '#6a0dad', fontWeight: '600' },
  hideBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#f9fafb' },
  hideBtnText:   { fontSize: 12, color: '#9ca3af' },

  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 12 },
  replyInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', minHeight: 100, marginBottom: 16 },
  sheetBtns:  { flexDirection: 'row', gap: 12 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: '#6a0dad', borderRadius: 10, alignItems: 'center' },
});
