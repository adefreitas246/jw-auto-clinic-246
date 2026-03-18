// app/(customer)/referral.tsx
// Customer referral screen — unique code, share options, referred friends list.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Share,
} from 'react-native';
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionHeader, ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { SCREEN_PADDING, cardShadow, borderRadius } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

type Referral = {
  _id:           string;
  name?:         string;
  dateJoined?:   string;
  status:        'pending' | 'completed';
  pointsAwarded: number;
};

type ReferralData = {
  _id:                  string;
  code:                 string;
  refereeDiscountType:  string;
  refereeDiscountValue: number;
  pointsPerReferral:    number;
  totalReferrals:       number;
  totalPointsEarned:    number;
  referrals:            Referral[];
};

// ── How it works steps ────────────────────────────────────────────────────────

function HowItWorksSteps({ pointsPerReferral }: { pointsPerReferral: number }) {
  const steps = [
    { icon: 'share-outline'    as const, label: 'Share your code with a friend' },
    { icon: 'calendar-outline' as const, label: 'Friend books their first wash' },
    { icon: 'gift-outline'     as const, label: `You both earn ${pointsPerReferral} points` },
  ];

  return (
    <>
      {steps.map((step, i) => (
        <Reanimated.View
          key={i}
          entering={FadeInDown.delay(200 + i * 60).duration(300)}
          style={rf.stepCard}
        >
          <View style={rf.stepNumber}>
            <Text style={rf.stepNumberText}>{i + 1}</Text>
          </View>
          <View style={rf.stepIconWrap}>
            <Ionicons name={step.icon} size={18} color={Colors.accent} />
          </View>
          <Text style={rf.stepText}>{step.label}</Text>
        </Reanimated.View>
      ))}
    </>
  );
}

// ── Referral row ──────────────────────────────────────────────────────────────

function ReferralRow({ referral }: { referral: Referral }) {
  const isCompleted = referral.status === 'completed';
  return (
    <View style={rf.refRow}>
      <View style={rf.refAvatar}>
        <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rf.refName}>{referral.name || 'Friend'}</Text>
        {referral.dateJoined ? (
          <Text style={rf.refDate}>
            Joined {new Date(referral.dateJoined).toLocaleDateString()}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[rf.statusBadge, isCompleted ? rf.statusBadgeComplete : rf.statusBadgePending]}>
          <Text style={[rf.statusText, isCompleted ? rf.statusTextComplete : rf.statusTextPending]}>
            {isCompleted ? 'Completed' : 'Pending'}
          </Text>
        </View>
        {isCompleted && referral.pointsAwarded > 0 ? (
          <Text style={rf.refPts}>+{referral.pointsAwarded} pts</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReferralScreen() {
  const [data,       setData]       = useState<ReferralData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const toastAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await axios.get<ReferralData>('/api/referrals/my-code');
      setData(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showCopiedToast() {
    setCopied(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setCopied(false));
  }

  async function handleCopy() {
    if (!data) return;
    await Clipboard.setStringAsync(data.code);
    showCopiedToast();
  }

  async function handleShare() {
    if (!data) return;
    const discount = data.refereeDiscountType === 'percent'
      ? `${data.refereeDiscountValue}% off`
      : `$${data.refereeDiscountValue.toFixed(2)} off`;

    const message =
      `Get ${discount} your first wash at Wash Hub!\n` +
      `Use my referral code: ${data.code}\n\n` +
      `(I'll earn ${data.pointsPerReferral} loyalty points when you complete your first booking)`;

    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      showCopiedToast();
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={rf.safe}>
        <ScreenHeader title="Refer a Friend" backButton />
        <View style={rf.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={rf.safe}>
        <ScreenHeader title="Refer a Friend" backButton />
        <View style={rf.center}>
          <Text style={{ color: Colors.textMuted }}>Could not load referral data.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const discountLabel = data.refereeDiscountType === 'percent'
    ? `${data.refereeDiscountValue}% off`
    : `$${data.refereeDiscountValue.toFixed(2)} off`;

  const pending   = data.referrals.filter(r => r.status === 'pending').length;

  return (
    <SafeAreaView style={rf.safe}>
      <ScreenHeader title="Refer a Friend" backButton />

      <ScrollView
        contentContainerStyle={rf.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero card ── */}
        <Reanimated.View entering={FadeIn.duration(350)}>
          <LinearGradient
            colors={[Colors.accentDark, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={rf.heroCard}
          >
            <View style={rf.heroIconWrap}>
              <Ionicons name="gift" size={44} color={Colors.white} style={{ opacity: 0.9 }} />
            </View>
            <Text style={rf.heroTitle}>Refer &amp; Earn</Text>
            <Text style={rf.heroDesc}>
              Give friends <Text style={rf.heroHighlight}>{discountLabel}</Text> on their first wash.{'\n'}
              You both earn <Text style={rf.heroHighlight}>{data.pointsPerReferral} loyalty points</Text>.
            </Text>
          </LinearGradient>
        </Reanimated.View>

        {/* ── Your code card ── */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(320)} style={rf.codeCard}>
          <Text style={rf.codeLabel}>Your Referral Code</Text>
          <Text style={rf.code}>{data.code}</Text>
          <View style={rf.actionRow}>
            <Pressable
              style={rf.actionBtn}
              onPress={handleCopy}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copied ? Colors.success : Colors.accent}
              />
              <Text style={[rf.actionBtnText, copied && { color: Colors.success }]}>
                {copied ? 'Copied!' : 'Copy Code'}
              </Text>
            </Pressable>

            <View style={rf.actionDivider} />

            <Pressable
              style={rf.actionBtn}
              onPress={handleShare}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <Ionicons name="share-outline" size={18} color={Colors.accent} />
              <Text style={rf.actionBtnText}>Share</Text>
            </Pressable>
          </View>
        </Reanimated.View>

        {/* ── Stats ── */}
        <Reanimated.View entering={FadeInDown.delay(140).duration(320)} style={rf.statsRow}>
          <View style={rf.statCard}>
            <Ionicons name="people-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{data.totalReferrals}</Text>
            <Text style={rf.statLbl}>Referred</Text>
          </View>
          <View style={rf.statCard}>
            <Ionicons name="star-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{data.totalPointsEarned}</Text>
            <Text style={rf.statLbl}>Points{'\n'}Earned</Text>
          </View>
          <View style={rf.statCard}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{pending}</Text>
            <Text style={rf.statLbl}>Pending</Text>
          </View>
        </Reanimated.View>

        {/* ── How it works ── */}
        <SectionHeader title="How It Works" />
        <HowItWorksSteps pointsPerReferral={data.pointsPerReferral} />

        {/* ── Referred friends ── */}
        {data.referrals.length > 0 && (
          <>
            <SectionHeader title="Referred Friends" />
            <View style={rf.refList}>
              {[...data.referrals].reverse().map(r => (
                <ReferralRow key={r._id} referral={r} />
              ))}
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Copied toast ── */}
      <Animated.View
        pointerEvents="none"
        style={[rf.toast, {
          opacity:   toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}
      >
        <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
        <Text style={rf.toastText}>Copied!</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rf = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SCREEN_PADDING, paddingTop: 20, paddingBottom: 100 },

  // Hero
  heroCard:      { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  heroIconWrap:  { marginBottom: 14 },
  heroTitle:     { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 10 },
  heroDesc:      { fontSize: 14, color: Colors.white, textAlign: 'center', lineHeight: 22, opacity: 0.9 },
  heroHighlight: { color: Colors.white, fontWeight: '800' },

  // Code card
  codeCard:   { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', ...cardShadow },
  codeLabel:  { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  code:       { fontSize: 28, fontWeight: '800', color: Colors.accent, letterSpacing: 6, fontFamily: IS_IOS ? 'Courier New' : 'monospace', marginBottom: 20 },
  actionRow:  { flexDirection: 'row', width: '100%', backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.lg, overflow: 'hidden' },
  actionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  actionDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 8 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  statVal:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLbl:  { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  // How it works steps
  stepCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  stepNumber:     { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accentMuted, borderWidth: 1.5, borderColor: Colors.accent, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  stepIconWrap:   { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepText:       { fontSize: 14, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  // Referred friends list
  refList:   { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...cardShadow },
  refRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  refAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  refName:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  refDate:   { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  refPts:    { fontSize: 12, fontWeight: '700', color: Colors.success },

  statusBadge:         { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeComplete: { backgroundColor: Colors.successBg },
  statusBadgePending:  { backgroundColor: Colors.warningBg },
  statusText:          { fontSize: 10, fontWeight: '700' },
  statusTextComplete:  { color: Colors.successText },
  statusTextPending:   { color: Colors.warningText },

  // Toast
  toast:     { position: 'absolute', bottom: 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.textPrimary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toastText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
});
