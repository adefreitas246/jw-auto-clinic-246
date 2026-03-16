// app/(tabs)/marketing/campaigns.tsx
// Broadcast push campaign composer — create, schedule, send, view delivery report.
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────
type Audience = 'all_customers' | 'loyalty_members' | 'subscribers' | 'inactive_30d';
type CampaignStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';

type Campaign = {
  _id:          string;
  title:        string;
  body:         string;
  audience:     Audience;
  scheduledAt:  string | null;
  status:       CampaignStatus;
  sentCount:    number;
  failedCount:  number;
  sentAt:       string | null;
  createdAt:    string;
  errorMessage: string;
};

const AUDIENCE_LABELS: Record<Audience, string> = {
  all_customers:   'All Customers',
  loyalty_members: 'Loyalty Members',
  subscribers:     'Subscribers',
  inactive_30d:    'Inactive 30+ Days',
};

const AUDIENCE_ICONS: Record<Audience, React.ComponentProps<typeof Ionicons>['name']> = {
  all_customers:   'people-outline',
  loyalty_members: 'gift-outline',
  subscribers:     'card-outline',
  inactive_30d:    'time-outline',
};

const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft:   Colors.textMuted,
  queued:  Colors.warning,
  sending: Colors.info,
  sent:    Colors.success,
  failed:  Colors.error,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <View style={[bd.statusBadge, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
      <Text style={[bd.statusText, { color: STATUS_COLOR[status] }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function DeliveryBar({ sent, failed }: { sent: number; failed: number }) {
  const total = sent + failed;
  if (total === 0) return null;
  const pct = (sent / total) * 100;
  return (
    <View style={bd.barWrap}>
      <View style={bd.barTrack}>
        <View style={[bd.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={bd.barLabel}>{sent} sent · {failed} failed</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CampaignsScreen() {
  const { token } = useAuth();
  const router    = useRouter();

  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState(false);
  const [editing,    setEditing]    = useState<Campaign | null>(null);
  const [reportCamp, setReportCamp] = useState<(Campaign & { audienceSize?: number }) | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [sending,    setSending]    = useState<string | null>(null);

  // Form state
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [audience,    setAudience]    = useState<Audience>('all_customers');
  const [useSchedule, setUseSchedule] = useState(false);
  const [schedDate,   setSchedDate]   = useState('');
  const [schedTime,   setSchedTime]   = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get<Campaign[]>('/api/marketing/campaigns', { headers });
      setCampaigns(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setTitle(''); setBody(''); setAudience('all_customers');
    setUseSchedule(false); setSchedDate(''); setSchedTime('');
    setModal(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setTitle(c.title); setBody(c.body); setAudience(c.audience);
    if (c.scheduledAt) {
      const d = new Date(c.scheduledAt);
      setUseSchedule(true);
      setSchedDate(d.toISOString().slice(0, 10));
      setSchedTime(d.toISOString().slice(11, 16));
    } else {
      setUseSchedule(false); setSchedDate(''); setSchedTime('');
    }
    setModal(true);
  }

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!body.trim())  { Alert.alert('Message required'); return; }

    let scheduledAt: string | null = null;
    if (useSchedule && schedDate) {
      const dt = new Date(`${schedDate}T${schedTime || '09:00'}:00`);
      if (isNaN(dt.getTime())) { Alert.alert('Invalid date/time'); return; }
      if (dt <= new Date())    { Alert.alert('Schedule must be in the future'); return; }
      scheduledAt = dt.toISOString();
    }

    try {
      setSaving(true);
      const payload = { title: title.trim(), body: body.trim(), audience, scheduledAt };
      if (editing) {
        await axios.patch(`/api/marketing/campaigns/${editing._id}`, payload, { headers });
      } else {
        await axios.post('/api/marketing/campaigns', payload, { headers });
      }
      setModal(false);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(c: Campaign) {
    const label = c.scheduledAt ? 'Queue for scheduled time' : 'Send now';
    Alert.alert(
      'Confirm Send',
      `${label} — ${c.title}\nAudience: ${AUDIENCE_LABELS[c.audience]}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label, onPress: async () => {
            try {
              setSending(c._id);
              const res = await axios.post(`/api/marketing/campaigns/${c._id}/send`, {}, { headers });
              if (res.data.queued) {
                Alert.alert('Queued', `Scheduled for ${new Date(c.scheduledAt!).toLocaleString()}`);
              } else {
                Alert.alert('Sent!', `Delivered to ${res.data.sent} devices (${res.data.failed} failed).`);
              }
              load();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error ?? 'Send failed.');
            } finally {
              setSending(null);
            }
          },
        },
      ]
    );
  }

  async function handleDelete(c: Campaign) {
    Alert.alert('Delete Campaign', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`/api/marketing/campaigns/${c._id}`, { headers });
            load();
          } catch {}
        },
      },
    ]);
  }

  async function openReport(c: Campaign) {
    try {
      const res = await axios.get(`/api/marketing/campaigns/${c._id}/report`, { headers });
      setReportCamp(res.data);
    } catch {}
  }

  if (loading) {
    return (
      <SafeAreaView style={bd.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={bd.safe}>
      {/* Header */}
      <View style={bd.header}>
        <Pressable
          onPress={() => router.back()}
          style={bd.backBtn}
          hitSlop={8}
          android_ripple={{ color: Colors.border, radius: 20, borderless: true }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={bd.headerTitle}>Push Campaigns</Text>
        <Pressable
          onPress={openCreate}
          style={bd.addBtn}
          android_ripple={{ color: Colors.accentDark, radius: 20, borderless: true }}
        >
          <Ionicons name="add" size={20} color={Colors.white} />
        </Pressable>
      </View>

      <FlatList
        data={campaigns}
        keyExtractor={c => c._id}
        contentContainerStyle={bd.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={bd.emptyWrap}>
            <View style={bd.emptyIcon}>
              <Ionicons name="megaphone-outline" size={36} color={Colors.textMuted} />
            </View>
            <Text style={bd.emptyTitle}>No campaigns yet</Text>
            <Text style={bd.empty}>Tap + to create your first broadcast.</Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <View style={bd.card}>
            <View style={bd.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={bd.cardTitle} numberOfLines={1}>{c.title}</Text>
                <View style={bd.audienceRow}>
                  <Ionicons name={AUDIENCE_ICONS[c.audience]} size={12} color={Colors.textSecondary} />
                  <Text style={bd.audienceText}>{AUDIENCE_LABELS[c.audience]}</Text>
                </View>
              </View>
              <CampaignStatusBadge status={c.status} />
            </View>

            <Text style={bd.cardBody} numberOfLines={2}>{c.body}</Text>

            {c.scheduledAt && c.status !== 'sent' && (
              <View style={bd.schedRow}>
                <Ionicons name="alarm-outline" size={12} color={Colors.warning} />
                <Text style={bd.schedText}>
                  Scheduled: {new Date(c.scheduledAt).toLocaleString()}
                </Text>
              </View>
            )}

            {c.status === 'sent' && (
              <DeliveryBar sent={c.sentCount} failed={c.failedCount} />
            )}

            {c.status === 'failed' && c.errorMessage ? (
              <Text style={bd.errText}>{c.errorMessage}</Text>
            ) : null}

            <View style={bd.actions}>
              {c.status === 'draft' && (
                <>
                  <Pressable
                    style={bd.actionBtn}
                    onPress={() => openEdit(c)}
                    android_ripple={{ color: Colors.accentMuted }}
                  >
                    <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
                    <Text style={[bd.actionText, { color: Colors.accent }]}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={bd.actionBtn}
                    onPress={() => handleSend(c)}
                    disabled={sending === c._id}
                    android_ripple={{ color: Colors.successBg }}
                  >
                    {sending === c._id
                      ? <ActivityIndicator size="small" color={Colors.success} />
                      : <>
                          <Ionicons name="send-outline" size={14} color={Colors.success} />
                          <Text style={[bd.actionText, { color: Colors.success }]}>
                            {c.scheduledAt ? 'Queue' : 'Send Now'}
                          </Text>
                        </>
                    }
                  </Pressable>
                  <Pressable
                    style={bd.actionBtn}
                    onPress={() => handleDelete(c)}
                    android_ripple={{ color: Colors.errorBg }}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.error} />
                    <Text style={[bd.actionText, { color: Colors.error }]}>Delete</Text>
                  </Pressable>
                </>
              )}
              {(c.status === 'sent' || c.status === 'failed') && (
                <Pressable
                  style={bd.actionBtn}
                  onPress={() => openReport(c)}
                  android_ripple={{ color: Colors.surfaceAlt }}
                >
                  <Ionicons name="bar-chart-outline" size={14} color={Colors.textSecondary} />
                  <Text style={[bd.actionText, { color: Colors.textSecondary }]}>Report</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      />

      {/* Create / Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
          <Pressable style={bd.backdrop} onPress={() => setModal(false)} />
          <ScrollView
            style={bd.sheet}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={bd.sheetHandle} />
            <Text style={bd.sheetTitle}>{editing ? 'Edit Campaign' : 'New Campaign'}</Text>

            <Text style={bd.label}>Notification Title *</Text>
            <TextInput
              style={bd.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Summer Special"
              placeholderTextColor={Colors.textMuted}
              maxLength={100}
            />
            <Text style={bd.charCount}>{title.length}/100</Text>

            <Text style={bd.label}>Message *</Text>
            <TextInput
              style={[bd.input, { minHeight: 80 }]}
              value={body}
              onChangeText={setBody}
              placeholder="Write your message…"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={bd.charCount}>{body.length}/500</Text>

            <Text style={bd.label}>Audience</Text>
            <View style={bd.audiencePicker}>
              {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => (
                <Pressable
                  key={a}
                  style={[bd.audienceChip, audience === a && bd.audienceChipActive]}
                  onPress={() => setAudience(a)}
                  android_ripple={{ color: Colors.accentMuted }}
                >
                  <Ionicons
                    name={AUDIENCE_ICONS[a]}
                    size={13}
                    color={audience === a ? Colors.accent : Colors.textSecondary}
                  />
                  <Text style={[bd.audienceChipText, audience === a && { color: Colors.accent }]}>
                    {AUDIENCE_LABELS[a]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={bd.scheduleToggle}>
              <View>
                <Text style={bd.label}>Schedule for later</Text>
                <Text style={bd.subLabel}>Leave off to send immediately.</Text>
              </View>
              <Switch
                value={useSchedule}
                onValueChange={setUseSchedule}
                trackColor={{ false: Colors.border, true: Colors.accentLight }}
                thumbColor={useSchedule ? Colors.accent : Colors.white}
              />
            </View>

            {useSchedule && (
              <View style={bd.schedFields}>
                <View style={{ flex: 1 }}>
                  <Text style={bd.label}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={bd.input}
                    value={schedDate}
                    onChangeText={setSchedDate}
                    placeholder="2025-08-15"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={bd.label}>Time (HH:MM)</Text>
                  <TextInput
                    style={bd.input}
                    value={schedTime}
                    onChangeText={setSchedTime}
                    placeholder="09:00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
            )}

            <View style={bd.sheetBtns}>
              <Pressable
                style={bd.sheetCancel}
                onPress={() => setModal(false)}
                android_ripple={{ color: Colors.border }}
              >
                <Text style={bd.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[bd.sheetConfirm, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                android_ripple={{ color: Colors.accentDark }}
              >
                <Text style={bd.sheetConfirmText}>
                  {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delivery report modal */}
      <Modal
        visible={!!reportCamp}
        transparent
        animationType="slide"
        onRequestClose={() => setReportCamp(null)}
      >
        <Pressable style={bd.backdrop} onPress={() => setReportCamp(null)} />
        {reportCamp && (
          <View style={bd.reportSheet}>
            <View style={bd.sheetHandle} />
            <Text style={bd.sheetTitle}>Delivery Report</Text>
            <Text style={bd.reportTitle}>{reportCamp.title}</Text>

            <View style={bd.reportGrid}>
              {[
                { label: 'Audience',  val: AUDIENCE_LABELS[reportCamp.audience], color: Colors.accent },
                { label: 'Est. Reach', val: String(reportCamp.audienceSize ?? '—'), color: Colors.textSecondary },
                { label: 'Sent',      val: String(reportCamp.sentCount),           color: Colors.success },
                { label: 'Failed',    val: String(reportCamp.failedCount),         color: Colors.error },
              ].map(r => (
                <View key={r.label} style={bd.reportStat}>
                  <Text style={[bd.reportStatVal, { color: r.color }]}>{r.val}</Text>
                  <Text style={bd.reportStatLbl}>{r.label}</Text>
                </View>
              ))}
            </View>

            {reportCamp.sentAt && (
              <Text style={bd.reportDate}>
                Sent at {new Date(reportCamp.sentAt).toLocaleString()}
              </Text>
            )}

            {reportCamp.sentCount + reportCamp.failedCount > 0 && (
              <View style={{ marginTop: 12 }}>
                <DeliveryBar sent={reportCamp.sentCount} failed={reportCamp.failedCount} />
              </View>
            )}

            {reportCamp.errorMessage ? (
              <Text style={[bd.errText, { marginTop: 8 }]}>{reportCamp.errorMessage}</Text>
            ) : null}

            <Pressable
              style={[bd.sheetConfirm, { marginTop: 20 }]}
              onPress={() => setReportCamp(null)}
              android_ripple={{ color: Colors.accentDark }}
            >
              <Text style={bd.sheetConfirmText}>Close</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const bd = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...cardShadow,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
  },

  emptyWrap:  { alignItems: 'center', paddingTop: 64, gap: 12 },
  emptyIcon:  {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  empty:      { color: Colors.textMuted, textAlign: 'center', fontSize: 13 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  audienceText:{ fontSize: 11, color: Colors.textSecondary },
  cardBody:    { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 8 },
  schedRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  schedText:   { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  errText:     { fontSize: 11, color: Colors.error, marginBottom: 6 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText:  { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  barWrap:  { marginBottom: 8 },
  barTrack: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill:  { height: 6, backgroundColor: Colors.success, borderRadius: 3 },
  barLabel: { fontSize: 11, color: Colors.textSecondary },

  actions:    {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceAlt,
    paddingTop: 10,
    marginTop: 4,
  },
  actionBtn:  {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    minWidth: 70,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionText: { fontSize: 12, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  reportSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  reportTitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  label:       {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 12,
  },
  subLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  charCount: { fontSize: 10, color: Colors.textMuted, textAlign: 'right', marginTop: 2 },

  audiencePicker:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  audienceChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  audienceChipText:   { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  schedFields: { flexDirection: 'row', gap: 12, marginTop: 4 },

  reportGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  reportStat:    {
    flex: 1,
    minWidth: '40%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  reportStatVal: { fontSize: 24, fontWeight: '800' },
  reportStatLbl: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  reportDate:    { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  sheetBtns:       { flexDirection: 'row', gap: 12, marginTop: 24 },
  sheetCancel: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  sheetCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  sheetConfirm: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  sheetConfirmText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
