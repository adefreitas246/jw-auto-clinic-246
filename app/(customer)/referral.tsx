// app/(customer)/referral.tsx
// Customer referral screen — shows their unique code, sharing options,
// and a count of successful referrals with points earned.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const router          = useRouter();

  const [data,       setData]       = useState<ReferralData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied,     setCopied]     = useState(false);

  // Toast animation
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
      `🚗 Get ${discount} your first wash at Wash Hub!\n` +
      `Use my referral code: ${data.code}\n` +
      `Book at: washhub.app\n\n` +
      `(I'll earn loyalty points when you complete your first booking 🎁)`;

    try {
      if (await Sharing.isAvailableAsync()) {
        // expo-sharing doesn't do text-only natively, so we share a simple text file
        // or fall back to Clipboard + alert on unsupported platforms
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
        <Text style={rf.muted}>Loading your referral code…</Text>
      </SafeAreaView>
    );
  }

  const discountLabel = data.refereeDiscountType === 'percent'
    ? `${data.refereeDiscountValue}% off`
    : `$${data.refereeDiscountValue.toFixed(2)} off`;

  return (
    <SafeAreaView style={rf.safe}>
      {/* Header */}
      <View style={rf.header}>
        <Pressable onPress={() => router.back()} style={rf.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={rf.headerTitle}>Refer a Friend</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={rf.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={rf.heroCard}>
          <Text style={rf.heroEmoji}>🎁</Text>
          <Text style={rf.heroTitle}>Share & Earn</Text>
          <Text style={rf.heroDesc}>
            Give friends <Text style={rf.heroHighlight}>{discountLabel}</Text> on their first wash.{'\n'}
            You earn <Text style={rf.heroHighlight}>{data.pointsPerReferral} loyalty points</Text> for each friend who books.
          </Text>
        </View>

        {/* Code card */}
        <View style={rf.codeCard}>
          <Text style={rf.codeLabel}>Your Referral Code</Text>
          <Pressable style={rf.codeBox} onPress={handleCopy} activeOpacity={0.7}>
            <Text style={rf.code}>{data.code}</Text>
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={22} color={copied ? '#10b981' : '#6a0dad'} />
          </Pressable>
          <Text style={rf.codeTip}>Tap to copy · Share with friends</Text>
        </View>

        {/* Share buttons */}
        <View style={rf.shareRow}>
          <Pressable style={rf.shareBtn} onPress={handleCopy}>
            <Ionicons name="copy-outline" size={18} color="#6a0dad" />
            <Text style={rf.shareBtnText}>Copy Code</Text>
          </Pressable>
          <Pressable style={[rf.shareBtn, rf.shareBtnPrimary]} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={[rf.shareBtnText, { color: '#fff' }]}>Share Message</Text>
          </Pressable>
        </View>

        {/* How it works */}
        <View style={rf.howCard}>
          <Text style={rf.howTitle}>How It Works</Text>
          {[
            { icon: 'share-outline',         label: 'Share your code with a friend' },
            { icon: 'calendar-outline',      label: 'Friend uses code on first booking' },
            { icon: 'gift-outline',          label: `Friend gets ${discountLabel} off automatically` },
            { icon: 'star-outline',          label: `You earn ${data.pointsPerReferral} points after their wash` },
          ].map((s, i) => (
            <View key={i} style={rf.howRow}>
              <View style={rf.howDot}>
                <Ionicons name={s.icon as any} size={14} color="#6a0dad" />
              </View>
              <Text style={rf.howText}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={rf.statsRow}>
          <View style={rf.statBox}>
            <Text style={rf.statVal}>{data.totalReferrals}</Text>
            <Text style={rf.statLbl}>Friends Referred</Text>
          </View>
          <View style={rf.statDiv} />
          <View style={rf.statBox}>
            <Text style={rf.statVal}>{data.totalPointsEarned}</Text>
            <Text style={rf.statLbl}>Points Earned</Text>
          </View>
        </View>

        {/* Recent referrals */}
        {data.referrals.length > 0 && (
          <>
            <Text style={rf.sectionTitle}>Recent Referrals</Text>
            {[...data.referrals].reverse().slice(0, 5).map(r => (
              <View key={r._id} style={rf.refRow}>
                <Ionicons name="person-circle-outline" size={20} color="#9ca3af" />
                <Text style={rf.refDate}>
                  Friend referred · {new Date(r.completedAt).toLocaleDateString()}
                </Text>
                <Text style={rf.refPts}>+{r.pointsAwarded} pts</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Copied toast */}
      <Animated.View
        pointerEvents="none"
        style={[rf.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
      >
        <Ionicons name="checkmark-circle" size={16} color="#fff" />
        <Text style={rf.toastText}>Copied!</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const rf = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  muted:  { color: '#9ca3af', fontSize: 14 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },

  heroCard:      { backgroundColor: '#f5f0ff', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#d8b4fe' },
  heroEmoji:     { fontSize: 44, marginBottom: 10 },
  heroTitle:     { fontSize: 22, fontWeight: '900', color: '#1f2937', marginBottom: 8 },
  heroDesc:      { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 22 },
  heroHighlight: { color: '#6a0dad', fontWeight: '800' },

  codeCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  codeLabel: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  codeBox:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 12, borderWidth: 2, borderColor: '#6a0dad', borderStyle: 'dashed', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8 },
  code:      { fontSize: 26, fontWeight: '900', color: '#6a0dad', letterSpacing: 3 },
  codeTip:   { fontSize: 11, color: '#9ca3af' },

  shareRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  shareBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#6a0dad', backgroundColor: '#fff' },
  shareBtnPrimary: { backgroundColor: '#6a0dad', borderColor: '#6a0dad' },
  shareBtnText:    { fontSize: 13, fontWeight: '700', color: '#6a0dad' },

  howCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  howRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  howDot:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f0ff', justifyContent: 'center', alignItems: 'center' },
  howText:  { fontSize: 13, color: '#374151', flex: 1 },

  statsRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  statBox:  { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 28, fontWeight: '900', color: '#6a0dad' },
  statLbl:  { fontSize: 11, color: '#9ca3af', marginTop: 3, textAlign: 'center' },
  statDiv:  { width: 1, backgroundColor: '#f3f4f6' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  refRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  refDate:   { flex: 1, fontSize: 13, color: '#4b5563' },
  refPts:    { fontSize: 13, fontWeight: '700', color: '#10b981' },

  toast:     { position: 'absolute', bottom: 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
