// app/(tabs)/marketing/sms.tsx
// SMS Reminder Automation — scaffold with setup guide and manual trigger.
// TODO: Wire up a real SMS provider (Twilio / local gateway) in:
//       backend/routes/marketing.js  →  POST /sms/send-reminders
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

type SetupStep = {
  num:   string;
  title: string;
  desc:  string;
  done:  boolean;
};

const SETUP_STEPS: SetupStep[] = [
  {
    num: '1', done: false,
    title: 'Choose an SMS provider',
    desc:  'Twilio (global) or a local Caribbean provider (Digicel, Flow). Create an account and get API credentials.',
  },
  {
    num: '2', done: false,
    title: 'Add environment variables',
    desc:  'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (or equivalent) in your .env file.',
  },
  {
    num: '3', done: false,
    title: 'Uncomment the SMS code',
    desc:  'Open backend/routes/marketing.js → POST /sms/send-reminders and uncomment the Twilio block (Option A) or the HTTP gateway block (Option B).',
  },
  {
    num: '4', done: false,
    title: 'Set up a daily cron job',
    desc:  'Call POST /api/marketing/sms/send-reminders every day at 09:00 (before 24h window). Use node-cron, Render Cron Jobs, Railway Tasks, or a free cron service like cron-job.org.',
  },
  {
    num: '5', done: false,
    title: 'Ensure customer phones are collected',
    desc:  'Confirm that User.phone is populated during registration or at booking time. SMS reminders are skipped for customers without a phone number.',
  },
];

export default function SmsScreen() {
  const { token } = useAuth();
  const router    = useRouter();
  const [triggering, setTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; total: number } | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  async function handleTrigger() {
    Alert.alert(
      'Run SMS Reminders',
      'This will send reminder SMS to all customers with appointments tomorrow. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Now',
          onPress: async () => {
            try {
              setTriggering(true);
              const res = await axios.post('/api/marketing/sms/send-reminders', {}, { headers });
              setLastResult({ sent: res.data.sent, total: res.data.total });
              Alert.alert(
                '✅ Done',
                `${res.data.sent} of ${res.data.total} reminders processed.\n` +
                `(SMS delivery requires provider setup — see scaffold steps.)`
              );
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error ?? 'Failed to trigger.');
            } finally {
              setTriggering(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={sm.safe}>
      <View style={sm.header}>
        <Pressable onPress={() => router.back()} style={sm.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={sm.headerTitle}>SMS Reminders</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={sm.scroll} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={sm.statusBanner}>
          <View style={sm.statusIcon}>
            <Ionicons name="construct-outline" size={22} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sm.statusTitle}>Setup Required</Text>
            <Text style={sm.statusDesc}>
              Complete the steps below to activate 24h appointment SMS reminders.
            </Text>
          </View>
        </View>

        {/* How it works */}
        <View style={sm.section}>
          <Text style={sm.sectionTitle}>How It Works</Text>
          <View style={sm.flowCard}>
            {[
              { icon: 'alarm-outline',       label: 'Cron fires daily at 09:00' },
              { icon: 'search-outline',       label: 'Finds bookings for tomorrow' },
              { icon: 'chatbox-outline',      label: 'Sends SMS to each customer' },
              { icon: 'checkmark-done-outline', label: 'Marks reminderScheduled = true' },
            ].map((step, i, arr) => (
              <View key={step.label} style={sm.flowStep}>
                <View style={sm.flowDot}>
                  <Ionicons name={step.icon as any} size={16} color={Colors.accent} />
                </View>
                <Text style={sm.flowLabel}>{step.label}</Text>
                {i < arr.length - 1 && <View style={sm.flowLine} />}
              </View>
            ))}
          </View>
        </View>

        {/* Setup steps */}
        <Text style={sm.sectionTitle}>Setup Checklist</Text>
        {SETUP_STEPS.map(step => (
          <View key={step.num} style={sm.stepCard}>
            <View style={[sm.stepNum, step.done && sm.stepNumDone]}>
              {step.done
                ? <Ionicons name="checkmark" size={14} color={Colors.white} />
                : <Text style={sm.stepNumText}>{step.num}</Text>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sm.stepTitle}>{step.title}</Text>
              <Text style={sm.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* Provider options */}
        <Text style={sm.sectionTitle}>Provider Options</Text>
        <View style={sm.providerCard}>
          <View style={sm.providerRow}>
            <View style={sm.providerIcon}>
              <Text style={sm.providerEmoji}>🌐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sm.providerName}>Twilio (Recommended)</Text>
              <Text style={sm.providerDesc}>
                Global SMS API. ~$0.0075/SMS to Caribbean numbers.
                Supports TTD bulk SMS with local number purchase.
              </Text>
              <View style={sm.envChips}>
                {['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'].map(k => (
                  <View key={k} style={sm.envChip}><Text style={sm.envChipText}>{k}</Text></View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={sm.providerCard}>
          <View style={sm.providerRow}>
            <View style={sm.providerIcon}>
              <Text style={sm.providerEmoji}>🇧🇧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sm.providerName}>Local Gateway (Barbados/Trinidad)</Text>
              <Text style={sm.providerDesc}>
                Contact Digicel Business or Flow Business for bulk SMS API access.
                Use the HTTP gateway scaffold (Option B) in the route file.
              </Text>
              <View style={sm.envChips}>
                {['SMS_GATEWAY_URL', 'SMS_API_KEY', 'SMS_SENDER_ID'].map(k => (
                  <View key={k} style={sm.envChip}><Text style={sm.envChipText}>{k}</Text></View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Code reference */}
        <View style={sm.codeRef}>
          <Ionicons name="code-slash-outline" size={16} color={Colors.accent} />
          <Text style={sm.codeRefText}>
            Edit: <Text style={sm.codeRefFile}>backend/routes/marketing.js</Text>
            {'\n'}Function: <Text style={sm.codeRefFile}>POST /sms/send-reminders</Text>
            {'\n'}Look for the <Text style={sm.codeRefFile}>// TODO</Text> comment block.
          </Text>
        </View>

        {/* Manual trigger */}
        <Text style={sm.sectionTitle}>Manual Trigger</Text>
        <View style={sm.triggerCard}>
          <Text style={sm.triggerDesc}>
            Test the endpoint manually. It will log to the server console until a real provider is configured.
          </Text>
          {lastResult && (
            <View style={sm.lastResult}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={sm.lastResultText}>
                Last run: {lastResult.sent} sent / {lastResult.total} total
              </Text>
            </View>
          )}
          <Pressable
            style={[sm.triggerBtn, triggering && { opacity: 0.6 }]}
            onPress={handleTrigger}
            disabled={triggering}
          >
            {triggering
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <>
                  <Ionicons name="play-circle-outline" size={18} color={Colors.white} />
                  <Text style={sm.triggerBtnText}>Run Reminder Job Now</Text>
                </>
            }
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sm = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surfaceAlt },
  scroll: { padding: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' },
  statusIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warningBg, justifyContent: 'center', alignItems: 'center' },
  statusTitle:  { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  statusDesc:   { fontSize: 12, color: '#78350f', lineHeight: 18 },

  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },

  flowCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowDot:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f0ff', justifyContent: 'center', alignItems: 'center' },
  flowLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  flowLine: { position: 'absolute', left: 15, top: 32, width: 2, height: 20, backgroundColor: Colors.border },

  stepCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  stepNum:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f0ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.accent },
  stepNumDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepNumText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  stepTitle:   { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  stepDesc:    { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  providerCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  providerRow:  { flexDirection: 'row', gap: 12 },
  providerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  providerEmoji: { fontSize: 20 },
  providerName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  providerDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  envChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  envChip:     { backgroundColor: '#1e1b4b', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  envChipText: { fontSize: 9, fontWeight: '700', color: '#e0e7ff', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  codeRef:     { flexDirection: 'row', gap: 10, backgroundColor: '#f5f0ff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#d8b4fe', alignItems: 'flex-start' },
  codeRefText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  codeRefFile: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: Colors.accent, fontWeight: '700' },

  triggerCard:  { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  triggerDesc:  { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  lastResult:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  lastResultText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  triggerBtn:   { backgroundColor: Colors.accent, borderRadius: 10, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  triggerBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
