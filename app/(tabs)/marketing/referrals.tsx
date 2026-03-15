// app/(tabs)/marketing/referrals.tsx
// Admin referral program stats — all referral codes, usage, points awarded.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

type ReferralStat = {
  _id:               string;
  code:              string;
  totalReferrals:    number;
  totalPointsEarned: number;
  userId:            { name: string; email: string } | null;
  createdAt:         string;
};

export default function ReferralStatsScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [refs,       setRefs]       = useState<ReferralStat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<ReferralStat[]>('/api/marketing/referral/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRefs(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const totalReferrals = refs.reduce((s, r) => s + r.totalReferrals, 0);
  const totalPoints    = refs.reduce((s, r) => s + r.totalPointsEarned, 0);

  return (
    <SafeAreaView style={rf.safe}>
      <View style={rf.header}>
        <Pressable onPress={() => router.back()} style={rf.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={rf.headerTitle}>Referral Program</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={refs}
        keyExtractor={r => r._id}
        contentContainerStyle={rf.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        ListHeaderComponent={
          <>
            {/* Stats strip */}
            <View style={rf.statsRow}>
              <View style={rf.statBox}>
                <Text style={rf.statVal}>{refs.length}</Text>
                <Text style={rf.statLbl}>Referrers</Text>
              </View>
              <View style={rf.statDiv} />
              <View style={rf.statBox}>
                <Text style={rf.statVal}>{totalReferrals}</Text>
                <Text style={rf.statLbl}>Referrals</Text>
              </View>
              <View style={rf.statDiv} />
              <View style={rf.statBox}>
                <Text style={rf.statVal}>{totalPoints}</Text>
                <Text style={rf.statLbl}>Pts Awarded</Text>
              </View>
            </View>

            <Text style={rf.sectionTitle}>All Referral Codes</Text>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={rf.emptyWrap}>
              <Ionicons name="people-circle-outline" size={48} color={Colors.border} />
              <Text style={rf.emptyTitle}>No referrals yet</Text>
              <Text style={rf.empty}>Referral codes are created automatically when customers visit their referral screen.</Text>
            </View>
          ) : null
        }
        renderItem={({ item: r }) => (
          <View style={rf.card}>
            <View style={rf.cardTop}>
              <View style={rf.avatar}>
                <Text style={rf.avatarText}>{(r.userId?.name || 'U')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rf.name}>{r.userId?.name ?? 'Unknown'}</Text>
                <Text style={rf.email}>{r.userId?.email ?? ''}</Text>
              </View>
              <View style={rf.codeBadge}>
                <Text style={rf.codeText}>{r.code}</Text>
              </View>
            </View>
            <View style={rf.statsRow2}>
              <View style={rf.miniStat}>
                <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
                <Text style={rf.miniStatText}>{r.totalReferrals} referred</Text>
              </View>
              <View style={rf.miniStat}>
                <Ionicons name="gift-outline" size={12} color={Colors.warning} />
                <Text style={rf.miniStatText}>{r.totalPointsEarned} pts earned</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const rf = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surfaceAlt },
  scroll: { padding: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  statsRow: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  statBox:  { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLbl:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statDiv:  { width: 1, backgroundColor: Colors.surfaceAlt },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  emptyWrap:    { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  empty:        { color: Colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 19 },

  card:     { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f5f0ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: Colors.accent },
  name:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  email:    { fontSize: 11, color: Colors.textMuted },
  codeBadge: { backgroundColor: '#f5f0ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  codeText:  { fontSize: 13, fontWeight: '800', color: Colors.accent, letterSpacing: 1 },
  statsRow2: { flexDirection: 'row', gap: 16 },
  miniStat:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatText: { fontSize: 12, color: Colors.textSecondary },
});
