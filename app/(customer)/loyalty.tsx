// app/(customer)/loyalty.tsx
// Customer loyalty dashboard — points balance, tier, milestone progress,
// history list, and redeem button.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────
type Milestone = { points: number; label: string; emoji: string };
type HistoryEntry = {
  _id: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus';
  points: number;
  description: string;
  createdAt: string;
};
type LoyaltyData = {
  account: {
    points: number;
    totalEarned: number;
    totalRedeemed: number;
    tier: 'bronze' | 'silver' | 'gold';
    history: HistoryEntry[];
  };
  config: {
    pointsPerDollar: number;
    redeemValue: number;
    minRedeem: number;
    silverThreshold: number;
    goldThreshold: number;
    milestones: Milestone[];
    enabled: boolean;
  };
  nextMilestone: Milestone | null;
  progress: number;
  redeemValueCents: number;
};

const TIER_META = {
  bronze: { color: Colors.warning, bg: Colors.warningBg, label: 'Bronze',  icon: '🥉' },
  silver: { color: Colors.textMuted, bg: Colors.surfaceAlt, label: 'Silver',  icon: '🥈' },
  gold:   { color: Colors.warning, bg: Colors.warningBg, label: 'Gold',    icon: '🥇' },
};

// ─── Animated points counter ──────────────────────────────────────────────────
function PointsCounter({ target }: { target: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animVal.setValue(0);
    const anim = Animated.timing(animVal, {
      toValue:         target,
      duration:        1200,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    const id = animVal.addListener(({ value }) => setDisplayed(Math.round(value)));
    anim.start();
    return () => { anim.stop(); animVal.removeListener(id); };
  }, [target]);

  return (
    <Text style={st.pointsNum}>{displayed.toLocaleString()}</Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LoyaltyScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [data,        setData]        = useState<LoyaltyData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [redeemModal, setRedeemModal] = useState(false);
  const [redeemPts,   setRedeemPts]   = useState('');
  const [redeeming,   setRedeeming]   = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await axios.get<LoyaltyData>('/api/loyalty/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
      Animated.timing(progressAnim, {
        toValue:         res.data.progress,
        duration:        1000,
        easing:          Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    } catch {
      // silently fail — user may not have an account yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem() {
    const pts = Number(redeemPts);
    if (!pts || pts <= 0) return;
    if (!data) return;

    const min = data.config.minRedeem ?? 50;
    if (pts < min) { Alert.alert('Too few points', `Minimum redemption is ${min} points.`); return; }
    if (pts > data.account.points) { Alert.alert('Insufficient points', `You only have ${data.account.points} pts.`); return; }

    try {
      setRedeeming(true);
      const res = await axios.post('/api/loyalty/redeem', { points: pts }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert(
        '✅ Points Redeemed',
        `$${res.data.discountAmount.toFixed(2)} discount applied.\nRemaining points: ${res.data.remainingPoints}`
      );
      setRedeemModal(false);
      setRedeemPts('');
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Redemption failed.');
    } finally {
      setRedeeming(false);
    }
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={st.center}>
        <Text style={st.muted}>Loading loyalty account…</Text>
      </SafeAreaView>
    );
  }

  const { account, config, nextMilestone, progress } = data;
  const tier  = TIER_META[account.tier] ?? TIER_META.bronze;
  const barW  = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const earned = account.totalEarned;
  const silverT = config.silverThreshold ?? 500;
  const goldT   = config.goldThreshold   ?? 1000;

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>Loyalty Rewards</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Tier + Points card */}
        <View style={[st.card, { backgroundColor: tier.bg }]}>
          <View style={st.tierRow}>
            <Text style={st.tierEmoji}>{tier.icon}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={[st.tierLabel, { color: tier.color }]}>{tier.label} Member</Text>
              <Text style={st.totalEarned}>{earned.toLocaleString()} pts earned lifetime</Text>
            </View>
          </View>
          <Text style={st.pointsLabel}>Available Points</Text>
          <PointsCounter target={account.points} />
          <Text style={st.redeemValue}>
            ≈ ${(account.points * (config.redeemValue ?? 0.01)).toFixed(2)} value
          </Text>
        </View>

        {/* Milestone progress */}
        {nextMilestone && (
          <View style={st.milestoneCard}>
            <Text style={st.milestoneTitle}>
              Next: {nextMilestone.emoji} {nextMilestone.label}
            </Text>
            <Text style={st.milestoneSubtitle}>
              {earned.toLocaleString()} / {nextMilestone.points.toLocaleString()} pts
            </Text>
            <View style={st.barTrack}>
              <Animated.View style={[st.barFill, { width: barW }]} />
            </View>
            <Text style={st.milestoneRemain}>
              {(nextMilestone.points - earned).toLocaleString()} pts to go
            </Text>
          </View>
        )}

        {/* Tier thresholds info */}
        <View style={st.tiersRow}>
          {[
            { icon: '🥉', label: 'Bronze',  pts: 0,         color: Colors.warning },
            { icon: '🥈', label: 'Silver',  pts: silverT,   color: Colors.textMuted },
            { icon: '🥇', label: 'Gold',    pts: goldT,     color: Colors.warning },
          ].map(t => (
            <View key={t.label} style={[st.tierChip, earned >= t.pts && account.tier !== 'bronze' || t.pts === 0 ? st.tierChipActive : {}]}>
              <Text style={st.tierChipEmoji}>{t.icon}</Text>
              <Text style={[st.tierChipLabel, { color: t.color }]}>{t.label}</Text>
              <Text style={st.tierChipPts}>{t.pts === 0 ? 'Start' : `${t.pts.toLocaleString()}+`}</Text>
            </View>
          ))}
        </View>

        {/* Redeem button */}
        {config.enabled !== false && account.points >= (config.minRedeem ?? 50) && (
          <Pressable style={st.redeemBtn} onPress={() => setRedeemModal(true)}>
            <Ionicons name="gift-outline" size={18} color={Colors.white} />
            <Text style={st.redeemBtnText}>Redeem Points</Text>
          </Pressable>
        )}

        {/* Stats row */}
        <View style={st.statsRow}>
          <View style={st.statBox}>
            <Text style={st.statVal}>{account.totalEarned.toLocaleString()}</Text>
            <Text style={st.statLbl}>Total Earned</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statBox}>
            <Text style={st.statVal}>{account.totalRedeemed.toLocaleString()}</Text>
            <Text style={st.statLbl}>Total Redeemed</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statBox}>
            <Text style={st.statVal}>{account.points.toLocaleString()}</Text>
            <Text style={st.statLbl}>Available</Text>
          </View>
        </View>

        {/* History */}
        <Text style={st.sectionTitle}>Points History</Text>
        {account.history.length === 0 ? (
          <Text style={st.empty}>No transactions yet. Complete a wash to earn points!</Text>
        ) : (
          [...account.history].reverse().map(h => (
            <View key={h._id} style={st.histRow}>
              <View style={[st.histDot, { backgroundColor: h.type === 'earn' ? Colors.success : h.type === 'redeem' ? Colors.error : Colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.histDesc}>{h.description || (h.type === 'earn' ? 'Points earned' : 'Points redeemed')}</Text>
                <Text style={st.histDate}>{new Date(h.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[st.histPts, { color: h.type === 'earn' ? Colors.success : Colors.error }]}>
                {h.type === 'earn' || h.type === 'bonus' ? '+' : '-'}{h.points}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Redeem Modal */}
      <Modal visible={redeemModal} transparent animationType="slide" onRequestClose={() => setRedeemModal(false)}>
        <Pressable style={st.modalBackdrop} onPress={() => setRedeemModal(false)} />
        <View style={st.modalSheet}>
          <Text style={st.modalTitle}>Redeem Points</Text>
          <Text style={st.modalSub}>
            You have {account.points} pts available.{'\n'}
            Min: {config.minRedeem ?? 50} pts · Value: ${config.redeemValue ?? 0.01}/pt
          </Text>
          <TextInput
            style={st.modalInput}
            value={redeemPts}
            onChangeText={setRedeemPts}
            keyboardType="numeric"
            placeholder={`Enter points (min ${config.minRedeem ?? 50})`}
            placeholderTextColor={Colors.textMuted}
          />
          {redeemPts ? (
            <Text style={st.modalPreview}>
              Discount ≈ ${(Number(redeemPts) * (config.redeemValue ?? 0.01)).toFixed(2)}
            </Text>
          ) : null}
          <View style={st.modalBtns}>
            <Pressable style={st.modalCancel} onPress={() => setRedeemModal(false)}>
              <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable style={[st.modalConfirm, redeeming && { opacity: 0.6 }]} onPress={handleRedeem} disabled={redeeming}>
              <Text style={{ color: Colors.white, fontWeight: '700' }}>
                {redeeming ? 'Redeeming…' : 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surfaceAlt },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  card:          { borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tierRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  tierEmoji:     { fontSize: 36 },
  tierLabel:     { fontSize: 18, fontWeight: '800' },
  totalEarned:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pointsLabel:   { fontSize: 12, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  pointsNum:     { fontSize: 52, fontWeight: '900', color: Colors.textPrimary, lineHeight: 58 },
  redeemValue:   { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  milestoneCard:     { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  milestoneTitle:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  milestoneSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, marginBottom: 10 },
  barTrack:          { height: 10, backgroundColor: Colors.surfaceAlt, borderRadius: 5, overflow: 'hidden' },
  barFill:           { height: 10, backgroundColor: Colors.accent, borderRadius: 5 },
  milestoneRemain:   { fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'right' },

  tiersRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tierChip:      { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  tierChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  tierChipEmoji: { fontSize: 20 },
  tierChipLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  tierChipPts:   { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  redeemBtn:     { backgroundColor: Colors.accent, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  redeemBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  statsRow:   { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  statBox:    { flex: 1, alignItems: 'center' },
  statVal:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLbl:    { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.surfaceAlt },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  empty:        { color: Colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },

  histRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt, gap: 10 },
  histDot:  { width: 10, height: 10, borderRadius: 5 },
  histDesc: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  histDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  histPts:  { fontSize: 15, fontWeight: '700' },

  muted: { color: Colors.textMuted, fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:    { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  modalSub:      { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalInput:    { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.textPrimary, marginBottom: 8 },
  modalPreview:  { fontSize: 13, color: Colors.accent, fontWeight: '600', marginBottom: 16 },
  modalBtns:     { flexDirection: 'row', gap: 12 },
  modalCancel:   { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: 10, alignItems: 'center' },
  modalConfirm:  { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center' },
});
