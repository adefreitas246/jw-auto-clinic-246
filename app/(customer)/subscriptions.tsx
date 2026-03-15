// app/(customer)/subscriptions.tsx
// Subscription plans list + customer subscription management.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const router    = useRouter();

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
        <Text style={st.muted}>Loading plans…</Text>
      </SafeAreaView>
    );
  }

  const renewDate = subscription ? new Date(subscription.renewalDate) : null;
  const daysLeft  = renewDate ? Math.ceil((renewDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </Pressable>
        <Text style={st.headerTitle}>Subscription Plans</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6a0dad" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Current subscription card */}
        {subscription && (
          <View style={st.currentCard}>
            <View style={st.currentHeader}>
              <View>
                <Text style={st.currentPlan}>{subscription.planId?.name}</Text>
                <Text style={st.currentStatus}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </Text>
              </View>
              <View style={st.statusBadge}>
                <Text style={st.statusBadgeText}>{subscription.status}</Text>
              </View>
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
                <Text style={[st.currentStatVal, daysLeft !== null && daysLeft <= 3 ? { color: '#ef4444' } : {}]}>
                  {daysLeft != null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft}d`) : '—'}
                </Text>
                <Text style={st.currentStatLbl}>Renews In</Text>
              </View>
            </View>

            {daysLeft != null && daysLeft <= 3 && daysLeft > 0 && (
              <View style={st.renewWarning}>
                <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" />
                <Text style={st.renewWarningText}>Renewal due soon — tap a plan to renew.</Text>
              </View>
            )}

            <Pressable
              style={[st.cancelBtn, cancelling && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={st.cancelBtnText}>{cancelling ? 'Cancelling…' : 'Cancel Subscription'}</Text>
            </Pressable>
          </View>
        )}

        {/* Plans grid */}
        <Text style={st.sectionTitle}>
          {subscription ? 'Switch Plan' : 'Choose a Plan'}
        </Text>

        {plans.length === 0 ? (
          <Text style={st.empty}>No plans available yet.</Text>
        ) : (
          plans.map(plan => {
            const isActive = subscription?.planId?._id === plan._id;
            return (
              <View key={plan._id} style={[st.planCard, plan.highlighted && st.planCardHighlight, isActive && st.planCardActive]}>
                {plan.highlighted && (
                  <View style={st.popularBadge}>
                    <Text style={st.popularBadgeText}>⭐ Most Popular</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[st.popularBadge, { backgroundColor: '#10b981' }]}>
                    <Text style={st.popularBadgeText}>✓ Current Plan</Text>
                  </View>
                )}
                <View style={st.planTop}>
                  <View>
                    <Text style={st.planName}>{plan.name}</Text>
                    {plan.description ? <Text style={st.planDesc}>{plan.description}</Text> : null}
                  </View>
                  <View style={st.priceBlock}>
                    <Text style={st.planPrice}>{plan.currency} {plan.price.toFixed(2)}</Text>
                    <Text style={st.planInterval}>/month</Text>
                  </View>
                </View>

                {plan.features.length > 0 && (
                  <View style={st.features}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={st.featureRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#6a0dad" />
                        <Text style={st.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={st.quotaRow}>
                  <Ionicons name="car-outline" size={14} color="#6b7280" />
                  <Text style={st.quotaText}>
                    {plan.jobQuota == null ? 'Unlimited washes' : `${plan.jobQuota} washes/month`}
                  </Text>
                </View>

                <Pressable
                  style={[st.subscribeBtn, isActive ? st.subscribeBtnDisabled : {}]}
                  onPress={() => !isActive && setConfirmPlan(plan)}
                  disabled={isActive}
                >
                  <Text style={[st.subscribeBtnText, isActive ? { color: '#9ca3af' } : {}]}>
                    {isActive ? 'Current Plan' : subscription ? 'Switch to this Plan' : 'Subscribe'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirm modal */}
      <Modal visible={!!confirmPlan} transparent animationType="slide" onRequestClose={() => setConfirmPlan(null)}>
        <Pressable style={st.backdrop} onPress={() => setConfirmPlan(null)} />
        {confirmPlan && (
          <View style={st.sheet}>
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
              <Pressable style={st.sheetCancel} onPress={() => setConfirmPlan(null)}>
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[st.sheetConfirm, subscribing && { opacity: 0.6 }]}
                onPress={() => handleSubscribe(confirmPlan)}
                disabled={subscribing}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
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
  safe:   { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  muted:  { color: '#9ca3af', fontSize: 14 },
  empty:  { color: '#9ca3af', textAlign: 'center', marginTop: 20, fontSize: 14 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },

  currentCard:    { backgroundColor: '#f5f0ff', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#d8b4fe' },
  currentHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  currentPlan:    { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  currentStatus:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge:    { backgroundColor: '#6a0dad', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  currentStats:   { flexDirection: 'row', marginBottom: 12 },
  currentStat:    { flex: 1, alignItems: 'center' },
  currentStatVal: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  currentStatLbl: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  statDiv:        { width: 1, backgroundColor: '#d8b4fe' },
  renewWarning:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderRadius: 8, padding: 8, marginBottom: 10 },
  renewWarningText: { fontSize: 12, color: '#92400e' },
  cancelBtn:      { alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5' },
  cancelBtnText:  { color: '#ef4444', fontWeight: '600', fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 12 },

  planCard:          { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  planCardHighlight: { borderColor: '#a855f7', borderWidth: 2 },
  planCardActive:    { borderColor: '#10b981', borderWidth: 2 },
  popularBadge:      { position: 'absolute', top: -1, right: 14, backgroundColor: '#6a0dad', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  popularBadgeText:  { color: '#fff', fontSize: 10, fontWeight: '700' },
  planTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName:      { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  planDesc:      { fontSize: 12, color: '#6b7280', marginTop: 2, maxWidth: 180 },
  priceBlock:    { alignItems: 'flex-end' },
  planPrice:     { fontSize: 22, fontWeight: '900', color: '#6a0dad' },
  planInterval:  { fontSize: 11, color: '#9ca3af' },
  features:      { marginBottom: 10 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  featureText:   { fontSize: 13, color: '#374151' },
  quotaRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  quotaText:     { fontSize: 12, color: '#6b7280' },
  subscribeBtn:      { backgroundColor: '#6a0dad', borderRadius: 10, padding: 13, alignItems: 'center' },
  subscribeBtnDisabled: { backgroundColor: '#f3f4f6' },
  subscribeBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 10 },
  sheetBody:  { fontSize: 14, color: '#4b5563', lineHeight: 22, marginBottom: 20 },
  sheetBtns:  { flexDirection: 'row', gap: 12 },
  sheetCancel:  { flex: 1, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  sheetConfirm: { flex: 1, padding: 14, backgroundColor: '#6a0dad', borderRadius: 10, alignItems: 'center' },
});
