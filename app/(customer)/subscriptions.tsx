// app/(customer)/subscriptions.tsx
// Subscription plans list + customer subscription management.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { SCREEN_PADDING, cardShadow, borderRadius } from '@/utils/platformStyles';
import { Badge, SectionHeader, ScreenHeader } from '@/components/ui';

type Plan = {
  _id:         string;
  name:        string;
  description: string;
  price:       number;
  currency:    string;
  jobQuota:    number | null;
  features:    string[];
  highlighted: boolean;
  sortOrder:   number;
};

type Subscription = {
  _id:         string;
  status:      string;
  startDate:   string;
  renewalDate: string;
  usedJobs:    number;
  planId:      Plan;
};

export default function SubscriptionsScreen() {
  const { token } = useAuth();

  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [confirmPlan,  setConfirmPlan]  = useState<Plan | null>(null);
  const [subscribing,  setSubscribing]  = useState(false);
  const [cancelling,   setCancelling]   = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        axios.get<Plan[]>('/api/subscriptions/plans', { headers }),
        axios.get<Subscription | null>('/api/subscriptions/my', { headers }),
      ]);
      setPlans(plansRes.data);
      setSubscription(subRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleSubscribe(plan: Plan) {
    try {
      setSubscribing(true);
      await axios.post('/api/subscriptions/subscribe', { planId: plan._id }, { headers });
      Alert.alert('Subscribed!', `You're now on the ${plan.name} plan.`);
      setConfirmPlan(null);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Failed to subscribe.');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleCancel() {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your current subscription?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel Subscription', style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await axios.post('/api/subscriptions/cancel', {}, { headers });
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              load();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error ?? 'Failed to cancel.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={st.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const renewDate = subscription ? new Date(subscription.renewalDate) : null;
  const daysLeft  = renewDate ? Math.ceil((renewDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <SafeAreaView style={st.safe}>
      <ScreenHeader title="Subscription Plans" backButton />

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Current subscription card */}
        {subscription && (
          <Animated.View entering={FadeIn.duration(350)} style={st.currentCardWrap}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={st.currentCard}
            >
              <View style={st.currentTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.currentPlanName}>{subscription.planId?.name}</Text>
                  <Text style={st.currentValidUntil}>
                    Valid until {renewDate ? renewDate.toLocaleDateString() : '—'}
                  </Text>
                </View>
                <View style={st.activeBadgeWrap}>
                  <View style={st.activeBadge}>
                    <Ionicons name="checkmark-circle" size={10} color={Colors.success} />
                    <Text style={st.activeBadgeText}>Active</Text>
                  </View>
                </View>
              </View>

              <View style={st.currentPriceRow}>
                <Text style={st.currentPrice}>
                  {subscription.planId?.currency} {subscription.planId?.price?.toFixed(2)}
                </Text>
                <Text style={st.currentPricePer}>/month</Text>
              </View>

              <View style={st.currentStats}>
                <View style={st.currentStat}>
                  <Text style={st.currentStatVal}>{subscription.usedJobs}</Text>
                  <Text style={st.currentStatLbl}>Jobs Used</Text>
                </View>
                <View style={st.statDiv} />
                <View style={st.currentStat}>
                  <Text style={st.currentStatVal}>
                    {subscription.planId?.jobQuota == null ? '∞' : subscription.planId.jobQuota}
                  </Text>
                  <Text style={st.currentStatLbl}>Quota</Text>
                </View>
                <View style={st.statDiv} />
                <View style={st.currentStat}>
                  <Text style={[st.currentStatVal, daysLeft !== null && daysLeft <= 3 ? { color: Colors.warning } : {}]}>
                    {daysLeft != null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft}d`) : '—'}
                  </Text>
                  <Text style={st.currentStatLbl}>Renews In</Text>
                </View>
              </View>

              {daysLeft != null && daysLeft <= 3 && daysLeft > 0 && (
                <View style={st.renewWarning}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                  <Text style={st.renewWarningText}>Renewal due soon — tap a plan to renew.</Text>
                </View>
              )}

              <Pressable
                style={[st.cancelBtn, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelling}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <Text style={st.cancelBtnText}>{cancelling ? 'Cancelling…' : 'Cancel Subscription'}</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Plans */}
        <SectionHeader title={subscription ? 'Switch Plan' : 'Choose a Plan'} />

        {plans.length === 0 ? (
          <Text style={st.empty}>No plans available yet.</Text>
        ) : (
          plans.map((plan, idx) => {
            const isActive = subscription?.planId?._id === plan._id;
            return (
              <Animated.View
                key={plan._id}
                entering={FadeInDown.delay(idx * 70).duration(320)}
                style={[st.planCard, plan.highlighted && st.planCardHighlight, isActive && st.planCardActive]}
              >
                {plan.highlighted && !isActive && (
                  <View style={st.popularBadge}>
                    <Ionicons name="star" size={9} color={Colors.white} />
                    <Text style={st.popularBadgeText}>Most Popular</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[st.popularBadge, { backgroundColor: Colors.success }]}>
                    <Ionicons name="checkmark" size={9} color={Colors.white} />
                    <Text style={st.popularBadgeText}>Current Plan</Text>
                  </View>
                )}

                <View style={st.planTop}>
                  <Text style={st.planName}>{plan.name}</Text>
                  {plan.description ? <Text style={st.planDesc}>{plan.description}</Text> : null}
                </View>

                <View style={st.priceRow}>
                  <Text style={st.planPrice}>{plan.currency} {plan.price.toFixed(2)}</Text>
                  <Text style={st.planInterval}>/month</Text>
                </View>

                {plan.features.length > 0 && (
                  <View style={st.features}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={st.featureRow}>
                        <Ionicons name="checkmark" size={16} color={Colors.success} />
                        <Text style={st.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={st.quotaRow}>
                  <Ionicons name="car-outline" size={14} color={Colors.textSecondary} />
                  <Text style={st.quotaText}>
                    {plan.jobQuota == null ? 'Unlimited washes' : `${plan.jobQuota} washes/month`}
                  </Text>
                </View>

                <Pressable
                  style={[st.subscribeBtn, isActive ? st.subscribeBtnDisabled : {}]}
                  onPress={() => !isActive && setConfirmPlan(plan)}
                  disabled={isActive}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  <Text style={[st.subscribeBtnText, isActive ? { color: Colors.textMuted } : {}]}>
                    {isActive ? 'Current Plan' : subscription ? 'Switch to this Plan' : 'Subscribe'}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirm modal */}
      <Modal visible={!!confirmPlan} transparent animationType="slide" onRequestClose={() => setConfirmPlan(null)}>
        <Pressable style={st.backdrop} onPress={() => setConfirmPlan(null)} />
        {confirmPlan && (
          <View style={st.sheet}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>
              {subscription ? 'Switch Plan' : 'Subscribe'} — {confirmPlan.name}
            </Text>
            <Text style={st.sheetBody}>
              {subscription
                ? `Your current subscription will be cancelled and you'll be moved to "${confirmPlan.name}" at ${confirmPlan.currency} ${confirmPlan.price.toFixed(2)}/month.`
                : `You're subscribing to "${confirmPlan.name}" for ${confirmPlan.currency} ${confirmPlan.price.toFixed(2)}/month.`}
              {'\n\n'}Payment is handled via WiPay / BIMPay. Contact the business to complete your payment.
            </Text>
            <View style={st.sheetBtns}>
              <Pressable
                style={st.sheetCancel}
                onPress={() => setConfirmPlan(null)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[st.sheetConfirm, subscribing && { opacity: 0.6 }]}
                onPress={() => handleSubscribe(confirmPlan)}
                disabled={subscribing}
                android_ripple={{ color: Colors.white + '30', borderless: false }}
              >
                <Text style={{ color: Colors.white, fontWeight: '700' }}>
                  {subscribing ? 'Processing…' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SCREEN_PADDING, paddingTop: 20, paddingBottom: SCROLL_PADDING_BOTTOM },
  empty:  { color: Colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },

  currentCardWrap: { marginBottom: 24 },
  currentCard:     { borderRadius: 20, padding: 24 },
  currentTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  currentPlanName: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  currentValidUntil: { fontSize: 13, color: Colors.white, opacity: 0.8 },
  activeBadgeWrap: { marginTop: 2 },
  activeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  currentPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 20 },
  currentPrice:    { fontSize: 32, fontWeight: '700', color: Colors.white },
  currentPricePer: { fontSize: 16, color: Colors.white, opacity: 0.7 },
  currentStats:    { flexDirection: 'row', marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 },
  currentStat:     { flex: 1, alignItems: 'center' },
  currentStatVal:  { fontSize: 20, fontWeight: '800', color: Colors.white },
  currentStatLbl:  { fontSize: 10, color: Colors.white, opacity: 0.8, marginTop: 2 },
  statDiv:         { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  renewWarning:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 10, marginBottom: 14 },
  renewWarningText:{ fontSize: 12, color: Colors.white, flex: 1 },
  cancelBtn:       { alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  cancelBtnText:   { color: Colors.white, fontWeight: '600', fontSize: 13 },

  planCard:          { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  planCardHighlight: { borderColor: Colors.accent, borderWidth: 2 },
  planCardActive:    { borderColor: Colors.success, borderWidth: 2 },
  popularBadge:      { position: 'absolute', top: -1, right: 14, backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  popularBadgeText:  { color: Colors.white, fontSize: 10, fontWeight: '700' },
  planTop:       { marginBottom: 8 },
  planName:      { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  planDesc:      { fontSize: 12, color: Colors.textSecondary },
  priceRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 14 },
  planPrice:     { fontSize: 26, fontWeight: '700', color: Colors.accent },
  planInterval:  { fontSize: 13, color: Colors.textMuted },
  features:      { marginBottom: 12 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText:   { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  quotaRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  quotaText:     { fontSize: 12, color: Colors.textSecondary },
  subscribeBtn:         { backgroundColor: Colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', overflow: 'hidden' },
  subscribeBtnDisabled: { backgroundColor: Colors.surfaceAlt },
  subscribeBtnText:     { color: Colors.white, fontWeight: '700', fontSize: 14 },

  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SCREEN_PADDING, paddingBottom: 40 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  sheetBody:   { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  sheetBtns:   { flexDirection: 'row', gap: 12 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: Colors.surfaceAlt, borderRadius: 10, alignItems: 'center', overflow: 'hidden' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center', overflow: 'hidden' },
});
