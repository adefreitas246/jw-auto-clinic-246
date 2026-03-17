// app/(customer)/referral.tsx
// Customer referral screen — shows their unique code, sharing options,
// and a count of successful referrals with points earned.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
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
} from 'react-native';
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { SCREEN_PADDING, cardShadow, borderRadius } from '@/utils/platformStyles';
import { SectionHeader, ScreenHeader } from '@/components/ui';

type ReferralData = {
  _id:               string;
  code:              string;
  refereeDiscountType:  string;
  refereeDiscountValue: number;
  pointsPerReferral: number;
  totalReferrals:    number;
  totalPointsEarned: number;
  referrals: {
    _id:           string;
    refereeUserId: string;
    pointsAwarded: number;
    completedAt:   string;
  }[];
};

export default function ReferralScreen() {
  const { token, user } = useAuth();

  const [data,       setData]       = useState<ReferralData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const toastAnim = useRef(new Animated.Value(0)).current;

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get<ReferralData>('/api/marketing/referral/my', { headers });
      setData(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

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
      `Use my referral code: ${data.code}\n` +
      `Book at: washhub.app\n\n` +
      `(I'll earn loyalty points when you complete your first booking)`;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Clipboard.setStringAsync(message);
        showCopiedToast();
        Alert.alert(
          'Message Copied!',
          'Your referral message has been copied. Paste it into WhatsApp, iMessage, or any chat app.',
          [{ text: 'OK' }]
        );
      } else {
        await Clipboard.setStringAsync(message);
        showCopiedToast();
      }
    } catch {
      Alert.alert('Could not share', 'Please copy your code and share it manually.');
    }
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={rf.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const discountLabel = data.refereeDiscountType === 'percent'
    ? `${data.refereeDiscountValue}% off`
    : `$${data.refereeDiscountValue.toFixed(2)} off`;

  return (
    <SafeAreaView style={rf.safe}>
      <ScreenHeader title="Refer a Friend" backButton />

      <ScrollView
        contentContainerStyle={rf.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Reanimated.View entering={FadeIn.duration(350)}>
          <LinearGradient
            colors={[Colors.accentDark, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={rf.heroCard}
          >
            <View style={rf.heroIconWrap}>
              <Ionicons name="gift" size={48} color={Colors.white} style={{ opacity: 0.9 }} />
            </View>
            <Text style={rf.heroTitle}>Refer Friends</Text>
            <Text style={rf.heroDesc}>
              Give friends <Text style={rf.heroHighlight}>{discountLabel}</Text> on their first wash.{'\n'}
              You earn <Text style={rf.heroHighlight}>{data.pointsPerReferral} loyalty points</Text> for each friend who books.
            </Text>
          </LinearGradient>
        </Reanimated.View>

        {/* Code card */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(320)} style={rf.codeCard}>
          <Text style={rf.codeLabel}>Your Code</Text>
          <Text style={rf.code}>{data.code}</Text>
          <View style={rf.shareButtonsRow}>
            <Pressable
              style={rf.shareCircleBtn}
              onPress={handleCopy}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <View style={rf.shareCircle}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={copied ? Colors.success : Colors.accent} />
              </View>
              <Text style={rf.shareCircleLabel}>Copy</Text>
            </Pressable>
            <Pressable
              style={rf.shareCircleBtn}
              onPress={handleShare}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <View style={rf.shareCircle}>
                <Ionicons name="logo-whatsapp" size={20} color={Colors.accent} />
              </View>
              <Text style={rf.shareCircleLabel}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={rf.shareCircleBtn}
              onPress={handleShare}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <View style={rf.shareCircle}>
                <Ionicons name="chatbubble-outline" size={20} color={Colors.accent} />
              </View>
              <Text style={rf.shareCircleLabel}>SMS</Text>
            </Pressable>
          </View>
        </Reanimated.View>

        {/* Stats row */}
        <Reanimated.View entering={FadeInDown.delay(160).duration(320)} style={rf.statsRow}>
          <View style={rf.statCard}>
            <Ionicons name="people-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{data.totalReferrals}</Text>
            <Text style={rf.statLbl}>Referred</Text>
          </View>
          <View style={rf.statCard}>
            <Ionicons name="star-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{data.totalPointsEarned}</Text>
            <Text style={rf.statLbl}>Earned</Text>
          </View>
          <View style={rf.statCard}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} style={{ marginBottom: 6 }} />
            <Text style={rf.statVal}>{Math.max(0, data.referrals.filter(r => !r.pointsAwarded).length)}</Text>
            <Text style={rf.statLbl}>Pending</Text>
          </View>
        </Reanimated.View>

        {/* How it works */}
        <SectionHeader title="How It Works" />

        {[
          { icon: 'share-outline',    label: 'Share your code with a friend' },
          { icon: 'calendar-outline', label: 'Friend uses code on first booking' },
          { icon: 'gift-outline',     label: `Friend gets ${discountLabel} off automatically` },
          { icon: 'star-outline',     label: `You earn ${data.pointsPerReferral} points after their wash` },
        ].map((s, i) => (
          <Reanimated.View
            key={i}
            entering={FadeInDown.delay(240 + i * 60).duration(300)}
            style={rf.stepCard}
          >
            <View style={rf.stepNumber}>
              <Text style={rf.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={rf.stepText}>{s.label}</Text>
          </Reanimated.View>
        ))}

        {/* Recent referrals */}
        {data.referrals.length > 0 && (
          <>
            <SectionHeader title="Recent Referrals" />
            {[...data.referrals].reverse().slice(0, 5).map(r => (
              <View key={r._id} style={rf.refRow}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.textMuted} />
                <Text style={rf.refDate}>
                  Friend referred · {new Date(r.completedAt).toLocaleDateString()}
                </Text>
                <Text style={rf.refPts}>+{r.pointsAwarded} pts</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Copied toast */}
      <Animated.View
        pointerEvents="none"
        style={[rf.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}
      >
        <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
        <Text style={rf.toastText}>Copied!</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const rf = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SCREEN_PADDING, paddingTop: 20, paddingBottom: 120 },

  heroCard:      { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  heroIconWrap:  { marginBottom: 16 },
  heroTitle:     { fontSize: 26, fontWeight: '700', color: Colors.white, marginBottom: 10 },
  heroDesc:      { fontSize: 14, color: Colors.white, textAlign: 'center', lineHeight: 22, opacity: 0.9 },
  heroHighlight: { color: Colors.white, fontWeight: '800' },

  codeCard:       { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', ...cardShadow },
  codeLabel:      { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  code:           { fontSize: 24, fontWeight: '800', color: Colors.accent, letterSpacing: 4, fontFamily: IS_IOS ? 'Courier New' : 'monospace', marginBottom: 20 },
  shareButtonsRow:{ flexDirection: 'row', gap: 24, justifyContent: 'center' },
  shareCircleBtn: { alignItems: 'center', gap: 6, overflow: 'hidden' },
  shareCircle:    { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.accentLight },
  shareCircleLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  statVal:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLbl:  { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  stepCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  stepNumber:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accentMuted, borderWidth: 1.5, borderColor: Colors.accent, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumberText: { fontSize: 14, fontWeight: '800', color: Colors.accent },
  stepText:       { fontSize: 14, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  refRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  refDate:   { flex: 1, fontSize: 13, color: Colors.textSecondary },
  refPts:    { fontSize: 13, fontWeight: '700', color: Colors.success },

  toast:     { position: 'absolute', bottom: 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.textPrimary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toastText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
});
