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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { ScreenHeader, Button } from '@/components/ui';

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

// Recipient options
type RecipientOption = 'all' | 'loyalty' | 'subscribers';
const RECIPIENT_OPTIONS: { key: RecipientOption; label: string; count: number }[] = [
  { key: 'all',         label: 'All Customers',    count: 342 },
  { key: 'loyalty',     label: 'Loyalty Members',  count: 118 },
  { key: 'subscribers', label: 'Subscribers',       count: 89 },
];

export default function SmsScreen() {
  const { token } = useAuth();
  const router    = useRouter();
  const [triggering,  setTriggering]  = useState(false);
  const [lastResult,  setLastResult]  = useState<{ sent: number; total: number } | null>(null);
  const [recipient,   setRecipient]   = useState<RecipientOption>('all');
  const [messageText, setMessageText] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const MAX_CHARS = 160;
  const charCount = messageText.length;

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
                'Done',
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

  const selectedOption = RECIPIENT_OPTIONS.find(o => o.key === recipient);

  return (
    <SafeAreaView style={sm.safe} edges={['top']}>
      <ScreenHeader title="Send SMS" backButton />

      <ScrollView contentContainerStyle={sm.scroll} showsVerticalScrollIndicator={false}>

        {/* Recipient picker — segmented control */}
        <ReAnimated.View entering={FadeInDown.delay(60).springify()} style={sm.segmentCard}>
          <View style={sm.segmentRow}>
            {RECIPIENT_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                style={[sm.segmentBtn, recipient === opt.key && sm.segmentBtnActive]}
                onPress={() => setRecipient(opt.key)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <Text style={[sm.segmentText, recipient === opt.key && sm.segmentTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ReAnimated.View>

        {/* Message compose */}
        <ReAnimated.View entering={FadeInDown.delay(120).springify()} style={sm.composeCard}>
          <Text style={sm.composeLabel}>Message</Text>
          <TextInput
            style={sm.composeInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type your SMS message here…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={MAX_CHARS}
            textAlignVertical="top"
          />
          <Text style={[sm.charCounter, charCount > MAX_CHARS * 0.9 && { color: Colors.error }]}>
            {charCount}/{MAX_CHARS}
          </Text>
        </ReAnimated.View>

        {/* Preview */}
        {messageText.trim().length > 0 && (
          <ReAnimated.View entering={FadeIn.duration(300)} style={sm.previewCard}>
            <Text style={sm.previewLabel}>Preview</Text>
            <View style={sm.smsBubble}>
              <Text style={sm.smsSender}>Wash Hub</Text>
              <Text style={sm.smsBody}>{messageText}</Text>
            </View>
          </ReAnimated.View>
        )}

        {/* Recipient count label + send button */}
        <ReAnimated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={sm.recipientCount}>
            Sending to {selectedOption?.count ?? 0} recipients
          </Text>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={triggering}
            onPress={handleTrigger}
            icon={<Ionicons name="send" size={18} color={Colors.white} />}
          >
            Send SMS
          </Button>
        </ReAnimated.View>

        {/* Last result */}
        {lastResult && (
          <ReAnimated.View entering={FadeIn.duration(300)} style={sm.lastResult}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={sm.lastResultText}>
              Last run: {lastResult.sent} sent / {lastResult.total} total
            </Text>
          </ReAnimated.View>
        )}

        {/* Setup section */}
        <Text style={sm.sectionTitle}>Setup Checklist</Text>
        {SETUP_STEPS.map((step, i) => (
          <ReAnimated.View
            key={step.num}
            entering={FadeInDown.delay(i * 60 + 300).springify()}
            style={sm.stepCard}
          >
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
          </ReAnimated.View>
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sm = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: SCROLL_PADDING_BOTTOM },

  // Segmented control
  segmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 4, marginBottom: 12,
  },
  segmentRow: { flexDirection: 'row', gap: 4 },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentBtnActive: { backgroundColor: Colors.accent },
  segmentText:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.white },

  // Compose card
  composeCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12,
    ...cardShadow,
  },
  composeLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  composeInput: {
    fontSize: 14, color: Colors.textPrimary,
    minHeight: 120, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: borderRadius.md,
    padding: 12,
    backgroundColor: Colors.background,
  },
  charCounter: { fontSize: 12, color: Colors.textMuted, textAlign: 'right', marginTop: 6 },

  // Preview
  previewCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12,
  },
  previewLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  smsBubble: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12, maxWidth: 280,
    borderWidth: 1, borderColor: Colors.border,
  },
  smsSender: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  smsBody:   { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  // Recipient + send
  recipientCount: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center',
    marginBottom: 10, fontWeight: '600',
  },

  lastResult: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successBg, borderRadius: borderRadius.md,
    padding: 12, marginTop: 12,
  },
  lastResultText: { fontSize: 13, color: Colors.success, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12, marginTop: 20 },

  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.accent,
  },
  stepNumDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepNumText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  stepTitle:   { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  stepDesc:    { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  providerCard: {
    backgroundColor: Colors.surface, borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  providerRow:   { flexDirection: 'row', gap: 12 },
  providerIcon:  {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  providerEmoji: { fontSize: 20 },
  providerName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  providerDesc:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  envChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  envChip:       {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
  },
  envChipText: {
    fontSize: 9, fontWeight: '700', color: Colors.accentMuted,
    fontFamily: IS_IOS ? 'Courier' : 'monospace',
  },

  codeRef: {
    flexDirection: 'row', gap: 10,
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.lg,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.accentLight,
    alignItems: 'flex-start',
  },
  codeRefText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  codeRefFile: {
    fontFamily: IS_IOS ? 'Courier' : 'monospace',
    color: Colors.accent, fontWeight: '700',
  },
});
