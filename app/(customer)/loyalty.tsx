// app/(customer)/loyalty.tsx
// Customer loyalty dashboard — points balance, tier, milestone progress,
// history list, and redeem button.
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, SectionHeader, SkeletonList } from '@/components/ui';

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
  bronze: { color: Colors.warning,   bg: Colors.warningBg,  label: 'Bronze', icon: '🥉' },
  silver: { color: Colors.textMuted, bg: Colors.surfaceAlt, label: 'Silver', icon: '🥈' },
  gold:   { color: Colors.warning,   bg: Colors.warningBg,  label: 'Gold',   icon: '🥇' },
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

// ─── Earn method row ──────────────────────────────────────────────────────────
function EarnMethodRow({
  icon,
  label,
  points,
  delay,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  points: string;
  delay: number;
}) {
  return (
    <Reanimated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View style={st.earnRow}>
        <View style={st.earnIconCircle}>
          <Ionicons name={icon} size={18} color={Colors.accent} />
        </View>
        <Text style={st.earnLabel}>{label}</Text>
        <View style={st.earnPointsBadge}>
          <Text style={st.earnPointsText}>{points}</Text>
        </View>
      </View>
    </Reanimated.View>
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
      <SafeAreaView style={st.safe}>
        <ScreenHeader title="Loyalty Rewards" backButton />
        <View style={st.loadingContainer}>
          <SkeletonList count={4} />
        </View>
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
      <ScreenHeader title="Loyalty Rewards" backButton />

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View entering={FadeIn.duration(300)}>
          {/* ── Hero points card (LinearGradient) ── */}
          <Reanimated.View entering={FadeInDown.delay(80).duration(300)}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight ?? Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.heroGradient}
            >
              <View style={st.heroTopRow}>
                <View>
                  <Text style={st.heroPointsLabel}>Loyalty Points</Text>
                  <PointsCounter target={account.points} />
                  <Text style={st.heroPointsUnit}>points</Text>
                </View>
                <View style={st.tierBadgeWrap}>
                  <Text style={st.tierEmoji}>{tier.icon}</Text>
                  <Text style={st.tierBadgeLabel}>{tier.label}</Text>
                </View>
              </View>

              <View style={st.heroValueRow}>
                <Ionicons name="cash-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={st.heroValue}>
                  ≈ ${(account.points * (config.redeemValue ?? 0.01)).toFixed(2)} value
                </Text>
              </View>
            </LinearGradient>
          </Reanimated.View>

          {/* ── Progress to next tier ── */}
          {nextMilestone && (
            <Reanimated.View entering={FadeInDown.delay(160).duration(300)}>
              <View style={st.progressCard}>
                <View style={st.progressTitleRow}>
                  <Text style={st.progressTitle}>
                    {nextMilestone.emoji} {nextMilestone.label}
                  </Text>
                  <Text style={st.progressRemain}>
                    {(nextMilestone.points - earned).toLocaleString()} more pts
                  </Text>
                </View>
                <Text style={st.progressSub}>
                  {earned.toLocaleString()} / {nextMilestone.points.toLocaleString()} pts
                </Text>
                <View style={st.barTrack}>
                  <Animated.View style={[st.barFill, { width: barW }]} />
                </View>
              </View>
            </Reanimated.View>
          )}

          {/* ── Tier chips ── */}
          <Reanimated.View entering={FadeInDown.delay(240).duration(300)}>
            <View style={st.tiersRow}>
              {[
                { icon: '🥉', label: 'Bronze', pts: 0,       color: Colors.warning },
                { icon: '🥈', label: 'Silver', pts: silverT, color: Colors.textMuted },
                { icon: '🥇', label: 'Gold',   pts: goldT,   color: Colors.warning },
              ].map(t => (
                <View
                  key={t.label}
                  style={[
                    st.tierChip,
                    (earned >= t.pts && account.tier !== 'bronze') || t.pts === 0
                      ? st.tierChipActive
                      : {},
                  ]}
                >
                  <Text style={st.tierChipEmoji}>{t.icon}</Text>
                  <Text style={[st.tierChipLabel, { color: t.color }]}>{t.label}</Text>
                  <Text style={st.tierChipPts}>
                    {t.pts === 0 ? 'Start' : `${t.pts.toLocaleString()}+`}
                  </Text>
                </View>
              ))}
            </View>
          </Reanimated.View>

          {/* ── Redeem button ── */}
          {config.enabled !== false && account.points >= (config.minRedeem ?? 50) && (
            <Reanimated.View entering={FadeInDown.delay(320).duration(300)}>
              <Pressable
                style={({ pressed }) => [st.redeemBtn, pressed && { opacity: 0.88 }]}
                onPress={() => {
                  if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setRedeemModal(true);
                }}
                android_ripple={{ color: Colors.accentDark, borderless: false }}
              >
                <Ionicons name="gift-outline" size={18} color={Colors.white} />
                <Text style={st.redeemBtnText}>Redeem Points</Text>
              </Pressable>
            </Reanimated.View>
          )}

          {/* ── Stats row ── */}
          <Reanimated.View entering={FadeInDown.delay(400).duration(300)}>
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
          </Reanimated.View>

          {/* ── How to earn points ── */}
          <Reanimated.View entering={FadeInDown.delay(480).duration(300)}>
            <SectionHeader title="How to Earn Points" />
            <View style={st.earnCard}>
              <EarnMethodRow
                icon="water-outline"
                label="Complete a wash"
                points={`${config.pointsPerDollar ?? 1} pt/$1`}
                delay={520}
              />
              <View style={st.earnSeparator} />
              <EarnMethodRow
                icon="people-outline"
                label="Refer a friend"
                points="50 pts"
                delay={560}
              />
              <View style={st.earnSeparator} />
              <EarnMethodRow
                icon="star-outline"
                label="Leave a review"
                points="10 pts"
                delay={600}
              />
              <View style={st.earnSeparator} />
              <EarnMethodRow
                icon="card-outline"
                label="Subscribe monthly"
                points="100 pts"
                delay={640}
              />
            </View>
          </Reanimated.View>

          {/* ── History ── */}
          <Reanimated.View entering={FadeInDown.delay(560).duration(300)}>
            <SectionHeader title="Recent Activity" />
          </Reanimated.View>

          {account.history.length === 0 ? (
            <Reanimated.View entering={FadeInDown.delay(600).duration(300)}>
              <View style={st.emptyWrap}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="receipt-outline" size={28} color={Colors.textMuted} />
                </View>
                <Text style={st.emptyTitle}>No activity yet</Text>
                <Text style={st.empty}>
                  Complete a wash to earn your first points!
                </Text>
              </View>
            </Reanimated.View>
          ) : (
            <View style={st.historyCard}>
              <FlatList
                data={[...account.history].reverse()}
                keyExtractor={h => h._id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: SCROLL_PADDING_BOTTOM }}
                ItemSeparatorComponent={() => <View style={st.histSeparator} />}
                renderItem={({ item: h, index }) => {
                  const isEarn = h.type === 'earn' || h.type === 'bonus';
                  return (
                    <Reanimated.View entering={FadeInDown.delay(index * 50).duration(250)}>
                      <View style={st.histRow}>
                        <View style={[
                          st.histIconCircle,
                          { backgroundColor: isEarn ? Colors.successBg : h.type === 'redeem' ? Colors.errorBg : Colors.warningBg },
                        ]}>
                          <Ionicons
                            name={isEarn ? 'add-circle-outline' : h.type === 'redeem' ? 'remove-circle-outline' : 'time-outline'}
                            size={16}
                            color={isEarn ? Colors.success : h.type === 'redeem' ? Colors.error : Colors.warning}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.histDesc}>
                            {h.description ||
                              (h.type === 'earn' ? 'Points earned' : 'Points redeemed')}
                          </Text>
                          <Text style={st.histDate}>
                            {new Date(h.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text
                          style={[
                            st.histPts,
                            { color: isEarn ? Colors.success : Colors.error },
                          ]}
                        >
                          {isEarn ? '+' : '-'}{h.points}
                        </Text>
                      </View>
                    </Reanimated.View>
                  );
                }}
              />
            </View>
          )}

        </Reanimated.View>
      </ScrollView>

      {/* ── Redeem Modal ── */}
      <Modal
        visible={redeemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRedeemModal(false)}
      >
        <Pressable style={st.modalBackdrop} onPress={() => setRedeemModal(false)} />
        <View style={st.modalSheet}>
          <View style={st.modalHandle} />
          <Text style={st.modalTitle}>Redeem Points</Text>
          <Text style={st.modalSub}>
            You have <Text style={{ color: Colors.accent, fontWeight: '700' }}>{account.points}</Text> pts available.{'\n'}
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
            <View style={st.modalPreviewBox}>
              <Ionicons name="pricetag-outline" size={14} color={Colors.accent} />
              <Text style={st.modalPreview}>
                Discount ≈ ${(Number(redeemPts) * (config.redeemValue ?? 0.01)).toFixed(2)}
              </Text>
            </View>
          ) : null}
          <View style={st.modalBtns}>
            <Pressable
              style={st.modalCancel}
              onPress={() => setRedeemModal(false)}
              android_ripple={{ color: Colors.border, borderless: false }}
            >
              <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[st.modalConfirm, redeeming && { opacity: 0.6 }]}
              onPress={handleRedeem}
              disabled={redeeming}
              android_ripple={{ color: Colors.accentDark, borderless: false }}
            >
              {redeeming ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={{ color: Colors.white, fontWeight: '700' }}>Confirm</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: 16 },
  scroll:           { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: SCROLL_PADDING_BOTTOM },

  // Hero gradient card
  heroGradient: {
    borderRadius: borderRadius.xl ?? borderRadius.lg,
    padding: 24,
    marginBottom: 16,
    ...(IS_IOS
      ? { shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 8 }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroPointsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginBottom: 4,
  },
  pointsNum: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 58,
  },
  heroPointsUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  tierBadgeWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tierEmoji:      { fontSize: 28, marginBottom: 4 },
  tierBadgeLabel: { fontSize: 12, fontWeight: '700', color: Colors.white },
  heroValueRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroValue:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // Progress card
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  progressTitle:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  progressSub:      { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  barTrack:         { height: 8, backgroundColor: Colors.accentMuted, borderRadius: 4, overflow: 'hidden' },
  barFill:          { height: 8, backgroundColor: Colors.accent, borderRadius: 4 },
  progressRemain:   { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Tier chips
  tiersRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tierChip:       { flex: 1, backgroundColor: Colors.surface, borderRadius: borderRadius.md, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, ...cardShadow },
  tierChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  tierChipEmoji:  { fontSize: 22 },
  tierChipLabel:  { fontSize: 12, fontWeight: '700', marginTop: 4 },
  tierChipPts:    { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Redeem button
  redeemBtn:     { backgroundColor: Colors.accent, borderRadius: borderRadius.md, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, ...cardShadow },
  redeemBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Stats
  statsRow:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  statBox:     { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLbl:     { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },

  // Earn methods
  earnCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    overflow: 'hidden',
    ...cardShadow,
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  earnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  earnLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  earnPointsBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  earnPointsText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  earnSeparator:  { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // History
  emptyWrap:    { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  empty:        { color: Colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 20 },

  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    ...cardShadow,
  },
  histRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  histSeparator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  histIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  histDesc:  { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  histDate:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  histPts:   { fontSize: 15, fontWeight: '700', flexShrink: 0 },

  muted: { color: Colors.textMuted, fontSize: 14, marginTop: 8 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet:    { backgroundColor: Colors.surface, borderTopLeftRadius: borderRadius.xl ?? borderRadius.lg, borderTopRightRadius: borderRadius.xl ?? borderRadius.lg, padding: 24, paddingBottom: 40 },
  modalHandle:   { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  modalSub:      { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalInput:    { borderWidth: 1.5, borderColor: Colors.border, borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: Colors.textPrimary, marginBottom: 8, backgroundColor: Colors.surfaceAlt },
  modalPreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  modalPreview:  { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  modalBtns:     { flexDirection: 'row', gap: 12 },
  modalCancel:   { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  modalConfirm:  { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
