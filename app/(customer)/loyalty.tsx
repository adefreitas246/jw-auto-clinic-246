// app/(customer)/loyalty.tsx — Customer loyalty dashboard
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Milestone = { points: number; label: string; emoji: string };

type HistoryEntry = {
  _id:         string;
  type:        'earn' | 'redeem' | 'expire' | 'bonus';
  points:      number;
  description: string;
  createdAt:   string;
};

type Reward = {
  _id:        string;
  name:       string;
  icon:       string;
  pointsCost: number;
};

type LoyaltyData = {
  account: {
    points:          number;
    totalEarned:     number;
    totalRedeemed:   number;
    washesThisMonth: number;
    totalWashes:     number;
    pointsThisMonth: number;
    tier:            'bronze' | 'silver' | 'gold';
    history:         HistoryEntry[];
  };
  config: {
    pointsPerDollar: number;
    redeemValue:     number;
    minRedeem:       number;
    silverThreshold: number;
    goldThreshold:   number;
    milestones:      Milestone[];
    enabled:         boolean;
  };
  nextMilestone:    Milestone | null;
  progress:         number;
  redeemValueCents: number;
  rewards:          Reward[];
};

const TIER_META = {
  bronze: { color: Colors.warning,   bg: Colors.warningBg,  label: 'Bronze', icon: '🥉' },
  silver: { color: Colors.textMuted, bg: Colors.surfaceAlt, label: 'Silver', icon: '🥈' },
  gold:   { color: Colors.warning,   bg: Colors.warningBg,  label: 'Gold',   icon: '🥇' },
};

// ── Animated points counter ───────────────────────────────────────────────────

function PointsCounter({ target }: { target: number }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animVal.setValue(0);
    const anim = Animated.timing(animVal, {
      toValue: target, duration: 1200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    const id = animVal.addListener(({ value }) => setDisplayed(Math.round(value)));
    anim.start();
    return () => { anim.stop(); animVal.removeListener(id); };
  }, [target]);

  return <Text style={st.pointsNum}>{displayed.toLocaleString()}</Text>;
}

// ── Reward card ───────────────────────────────────────────────────────────────

function RewardCard({
  reward, currentPoints, onRedeem,
}: {
  reward:        Reward;
  currentPoints: number;
  onRedeem:      (r: Reward) => void;
}) {
  const canAfford = currentPoints >= reward.pointsCost;
  return (
    <View style={[st.rewardCard, !canAfford && st.rewardCardDim]}>
      <View style={[st.rewardIconWrap, !canAfford && { backgroundColor: Colors.surfaceAlt }]}>
        <Ionicons
          name={(reward.icon || 'gift-outline') as any}
          size={24}
          color={canAfford ? Colors.accent : Colors.textMuted}
        />
      </View>
      <Text style={[st.rewardName, !canAfford && { color: Colors.textMuted }]} numberOfLines={2}>
        {reward.name}
      </Text>
      <Text style={[st.rewardCost, !canAfford && { color: Colors.textMuted }]}>
        {reward.pointsCost.toLocaleString()} pts
      </Text>
      <Pressable
        style={[st.redeemCardBtn, !canAfford && st.redeemCardBtnDim]}
        onPress={() => canAfford && onRedeem(reward)}
        disabled={!canAfford}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        <Text style={[st.redeemCardBtnText, !canAfford && { color: Colors.textMuted }]}>
          {canAfford ? 'Redeem' : 'Not enough'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Earn method row ───────────────────────────────────────────────────────────

function EarnMethodRow({
  icon, label, points, delay,
}: {
  icon:   React.ComponentProps<typeof Ionicons>['name'];
  label:  string;
  points: string;
  delay:  number;
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoyaltyScreen() {
  const { token } = useAuth();

  const [data,        setData]        = useState<LoyaltyData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [redeemModal, setRedeemModal] = useState(false);
  const [redeemPts,   setRedeemPts]   = useState('');
  const [redeeming,   setRedeeming]   = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await axios.get<LoyaltyData>('/api/loyalty', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
      Animated.timing(progressAnim, {
        toValue: res.data.progress, duration: 1000,
        easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start();
    } catch {
      // silently fail — user may not have a loyalty account yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleRedeem = async () => {
    const pts = Number(redeemPts);
    if (!pts || pts <= 0 || !data) return;
    const min = data.config.minRedeem ?? 50;
    if (pts < min) { Alert.alert('Too few points', `Minimum redemption is ${min} points.`); return; }
    if (pts > data.account.points) { Alert.alert('Insufficient points', `You only have ${data.account.points} pts.`); return; }
    try {
      setRedeeming(true);
      const res = await axios.post('/api/loyalty/redeem', { points: pts }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert(
        'Points Redeemed',
        `$${res.data.discountAmount.toFixed(2)} discount applied.\nRemaining: ${res.data.remainingPoints} pts`,
      );
      setRedeemModal(false);
      setRedeemPts('');
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Redemption failed.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleRedeemReward = (reward: Reward) => {
    Alert.alert(
      `Redeem: ${reward.name}`,
      `This will use ${reward.pointsCost.toLocaleString()} of your points.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            try {
              await axios.post(
                '/api/loyalty/redeem',
                { points: reward.pointsCost, rewardId: reward._id },
                { headers: { Authorization: `Bearer ${token}` } },
              );
              Alert.alert('Redeemed!', `You unlocked "${reward.name}".`);
              load();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error ?? 'Redemption failed.');
            }
          },
        },
      ],
    );
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={st.safe}>
        <ScreenHeader title="Rewards" backButton />
        <View style={st.loadingContainer}>
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const { account, config, nextMilestone, progress } = data;
  const rewards  = data.rewards ?? [];
  const tier     = TIER_META[account.tier] ?? TIER_META.bronze;
  const barW     = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const ptsToNext = nextMilestone ? Math.max(0, nextMilestone.points - account.totalEarned) : 0;

  return (
    <SafeAreaView style={st.safe}>
      <ScreenHeader title="Rewards" backButton />

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

          {/* ── Points balance card ── */}
          <Reanimated.View entering={FadeInDown.delay(80).duration(300)}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight ?? Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.heroGradient}
            >
              <View style={st.heroTopRow}>
                {/* Left: points */}
                <View>
                  <Text style={st.heroPointsLabel}>Loyalty Points</Text>
                  <PointsCounter target={account.points} />
                  <Text style={st.heroPointsUnit}>points</Text>
                </View>

                {/* Right: tier badge */}
                <View style={st.tierBadgeWrap}>
                  <Text style={st.tierEmoji}>{tier.icon}</Text>
                  <Text style={st.tierBadgeLabel}>{tier.label}</Text>
                </View>
              </View>

              {/* Cash value */}
              <View style={st.heroValueRow}>
                <Ionicons name="cash-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={st.heroValue}>
                  ≈ ${(account.points * (config.redeemValue ?? 0.01)).toFixed(2)} value
                </Text>
              </View>

              {/* Progress bar to next reward */}
              {nextMilestone && (
                <View style={st.heroProgress}>
                  <Text style={st.heroProgressText}>
                    {ptsToNext.toLocaleString()} more points to {nextMilestone.emoji} {nextMilestone.label}
                  </Text>
                  <View style={st.heroBarTrack}>
                    <Animated.View style={[st.heroBarFill, { width: barW }]} />
                  </View>
                </View>
              )}
            </LinearGradient>
          </Reanimated.View>

          {/* ── Quick stats row ── */}
          <Reanimated.View entering={FadeInDown.delay(160).duration(300)}>
            <View style={st.statsRow}>
              <View style={st.statBox}>
                <Text style={st.statVal}>{account.washesThisMonth ?? 0}</Text>
                <Text style={st.statLbl}>Washes{'\n'}This Month</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statBox}>
                <Text style={st.statVal}>{account.totalWashes ?? 0}</Text>
                <Text style={st.statLbl}>Total{'\n'}Washes</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statBox}>
                <Text style={st.statVal}>{(account.pointsThisMonth ?? 0).toLocaleString()}</Text>
                <Text style={st.statLbl}>Points{'\n'}This Month</Text>
              </View>
            </View>
          </Reanimated.View>

          {/* ── Rewards catalog ── */}
          {rewards.length > 0 && (
            <Reanimated.View entering={FadeInDown.delay(240).duration(300)}>
              <SectionHeader title="Rewards Catalog" />
              <View style={st.rewardsGrid}>
                {rewards.map(r => (
                  <RewardCard
                    key={r._id}
                    reward={r}
                    currentPoints={account.points}
                    onRedeem={handleRedeemReward}
                  />
                ))}
              </View>
            </Reanimated.View>
          )}

          {/* ── Redeem points button ── */}
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

          {/* ── How to earn points ── */}
          <Reanimated.View entering={FadeInDown.delay(400).duration(300)}>
            <SectionHeader title="How to Earn Points" />
            <View style={st.earnCard}>
              <EarnMethodRow icon="water-outline"  label="Complete a wash"     points={`${config.pointsPerDollar ?? 1} pt/$1`} delay={440} />
              <View style={st.earnSeparator} />
              <EarnMethodRow icon="people-outline" label="Refer a friend"      points="50 pts"  delay={480} />
              <View style={st.earnSeparator} />
              <EarnMethodRow icon="star-outline"   label="Leave a review"      points="10 pts"  delay={520} />
              <View style={st.earnSeparator} />
              <EarnMethodRow icon="card-outline"   label="Subscribe monthly"   points="100 pts" delay={560} />
            </View>
          </Reanimated.View>

          {/* ── Points history ── */}
          <Reanimated.View entering={FadeInDown.delay(480).duration(300)}>
            <SectionHeader title="Points History" />
          </Reanimated.View>

          {account.history.length === 0 ? (
            <Reanimated.View entering={FadeInDown.delay(520).duration(300)}>
              <View style={st.emptyWrap}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="receipt-outline" size={28} color={Colors.textMuted} />
                </View>
                <Text style={st.emptyTitle}>No activity yet</Text>
                <Text style={st.emptyText}>Complete a wash to earn your first points!</Text>
              </View>
            </Reanimated.View>
          ) : (
            <View style={st.historyCard}>
              <FlatList
                data={[...account.history].reverse()}
                keyExtractor={h => h._id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={st.histSeparator} />}
                renderItem={({ item: h, index }) => {
                  const isEarn   = h.type === 'earn' || h.type === 'bonus';
                  const isRedeem = h.type === 'redeem';
                  return (
                    <Reanimated.View entering={FadeInDown.delay(index * 40).duration(250)}>
                      <View style={st.histRow}>
                        <View style={[
                          st.histIconCircle,
                          { backgroundColor: isEarn ? Colors.successBg : isRedeem ? Colors.errorBg : Colors.warningBg },
                        ]}>
                          <Ionicons
                            name={isEarn ? 'add-circle-outline' : isRedeem ? 'remove-circle-outline' : 'time-outline'}
                            size={16}
                            color={isEarn ? Colors.success : isRedeem ? Colors.error : Colors.warning}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.histDesc}>
                            {h.description || (isEarn ? 'Points earned' : 'Points redeemed')}
                          </Text>
                          <Text style={st.histDate}>
                            {new Date(h.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={[st.histPts, { color: isEarn ? Colors.success : Colors.error }]}>
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

      {/* ── Redeem modal ── */}
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
            You have{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>{account.points}</Text>{' '}
            pts available.{'\n'}
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
              {redeeming
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={{ color: Colors.white, fontWeight: '700' }}>Confirm</Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: 16 },
  scroll:           { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: SCROLL_PADDING_BOTTOM },

  // Hero gradient card
  heroGradient: {
    borderRadius: borderRadius.xl,
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
    marginBottom: 12,
  },
  heroPointsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  pointsNum:       { fontSize: 48, fontWeight: '800', color: Colors.white, lineHeight: 54 },
  heroPointsUnit:  { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },
  tierBadgeWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  tierEmoji:      { fontSize: 28, marginBottom: 4 },
  tierBadgeLabel: { fontSize: 12, fontWeight: '700', color: Colors.white },
  heroValueRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  heroValue:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // Progress bar (inside hero card)
  heroProgress:     { gap: 8 },
  heroProgressText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroBarTrack:     { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  heroBarFill:      { height: 6, backgroundColor: Colors.accentLight, borderRadius: 3 },

  // Quick stats row
  statsRow:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  statBox:     { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLbl:     { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center', lineHeight: 15 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  // Rewards catalog grid
  rewardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  rewardCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  rewardCardDim:    { opacity: 0.6 },
  rewardIconWrap:   {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  rewardName:       { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  rewardCost:       { fontSize: 12, fontWeight: '600', color: Colors.accent, marginBottom: 12 },
  redeemCardBtn:    {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 8,
    overflow: 'hidden',
  },
  redeemCardBtnDim: { backgroundColor: Colors.surfaceAlt },
  redeemCardBtnText:{ fontSize: 12, fontWeight: '700', color: Colors.white },

  // Redeem button
  redeemBtn:     { backgroundColor: Colors.accent, borderRadius: borderRadius.md, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24, ...cardShadow },
  redeemBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Earn methods
  earnCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 24,
    overflow: 'hidden',
    ...cardShadow,
  },
  earnRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  earnIconCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  earnLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  earnPointsBadge: { backgroundColor: Colors.accentMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  earnPointsText:  { fontSize: 12, fontWeight: '700', color: Colors.accent },
  earnSeparator:   { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Points history
  emptyWrap:     { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyText:     { color: Colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 20 },

  historyCard:    { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, overflow: 'hidden', ...cardShadow },
  histRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  histSeparator:  { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  histIconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  histDesc:       { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  histDate:       { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  histPts:        { fontSize: 15, fontWeight: '700', flexShrink: 0 },

  // Redeem modal
  modalBackdrop:   { flex: 1, backgroundColor: Colors.overlay },
  modalSheet:      { backgroundColor: Colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: 24, paddingBottom: 40 },
  modalHandle:     { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  modalSub:        { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalInput:      { borderWidth: 1.5, borderColor: Colors.border, borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: Colors.textPrimary, marginBottom: 8, backgroundColor: Colors.surfaceAlt },
  modalPreviewBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  modalPreview:    { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  modalBtns:       { flexDirection: 'row', gap: 12 },
  modalCancel:     { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  modalConfirm:    { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
