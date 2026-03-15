// app/(tabs)/jobs/manage.tsx — Admin Job Management Dashboard
// Full oversight and control: view all jobs, change any status, assign staff.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, FlatList, Modal,
  Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import {
  ADVANCE_BUTTON_LABELS,
  JobStatus,
  JobSummary,
  JOB_STEPS,
  NEXT_JOB_STATUS,
  STAFF_STATUS_COLORS,
  STAFF_STATUS_LABELS,
} from '@/types/job';
import { Colors } from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Worker {
  _id:  string;
  name: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayISO()                { return new Date().toISOString().slice(0, 10); }
function shiftISO(iso: string, d: number) {
  const dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}
function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({
  status,
  onPress,
}: {
  status:  JobStatus;
  onPress?: () => void;
}) {
  const { bg, text } = STAFF_STATUS_COLORS[status];
  return (
    <Pressable
      style={[ad.badge, { backgroundColor: bg }, onPress && { paddingRight: 6 }]}
      onPress={onPress}
      hitSlop={4}
    >
      <Text style={[ad.badgeText, { color: text }]}>
        {STAFF_STATUS_LABELS[status]}
      </Text>
      {onPress && <Ionicons name="chevron-down" size={10} color={text} />}
    </Pressable>
  );
}

// ─── Status picker modal ──────────────────────────────────────────────────────
function StatusPickerModal({
  job,
  onSelect,
  onClose,
}: {
  job:      JobSummary | null;
  onSelect: (jobId: string, status: JobStatus) => void;
  onClose:  () => void;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (job) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [job]);

  if (!job) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ad.backdrop} onPress={onClose} />
      <Animated.View style={[ad.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={ad.sheetHandle} />
        <Text style={ad.sheetTitle}>Change Status</Text>
        <Text style={ad.sheetSub} numberOfLines={1}>{job.serviceLabel}</Text>

        {JOB_STEPS.map(step => {
          const isCurrent = step.status === job.jobStatus;
          const { bg, text } = STAFF_STATUS_COLORS[step.status];
          return (
            <Pressable
              key={step.status}
              style={[ad.statusOption, isCurrent && { backgroundColor: bg }]}
              onPress={() => { onSelect(job._id, step.status); onClose(); }}
            >
              <View style={[ad.statusDot, { backgroundColor: isCurrent ? text : Colors.border }]} />
              <Text style={[ad.statusOptionText, isCurrent && { color: text, fontWeight: '700' }]}>
                {STAFF_STATUS_LABELS[step.status]}
              </Text>
              {isCurrent && <Ionicons name="checkmark" size={16} color={text} />}
            </Pressable>
          );
        })}

        <Pressable style={ad.cancelBtn} onPress={onClose}>
          <Text style={ad.cancelBtnText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Assign technician modal ──────────────────────────────────────────────────
function AssignModal({
  job,
  workers,
  onSelect,
  onClose,
}: {
  job:      JobSummary | null;
  workers:  Worker[];
  onSelect: (jobId: string, staffId: string, name: string) => void;
  onClose:  () => void;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (job) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [job]);

  if (!job) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ad.backdrop} onPress={onClose} />
      <Animated.View style={[ad.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={ad.sheetHandle} />
        <Text style={ad.sheetTitle}>Assign Technician</Text>
        <Text style={ad.sheetSub} numberOfLines={1}>{job.serviceLabel}</Text>

        {/* Unassign option */}
        <Pressable
          style={[ad.assignOption, !job.assignedStaffId && ad.assignOptionActive]}
          onPress={() => { onSelect(job._id, '', ''); onClose(); }}
        >
          <View style={ad.assignAvatar}>
            <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
          </View>
          <Text style={[ad.assignName, !job.assignedStaffId && { color: Colors.accent, fontWeight: '700' }]}>
            Unassigned
          </Text>
          {!job.assignedStaffId && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
        </Pressable>

        {workers.map(w => {
          const isSelected = job.assignedStaffId === w._id;
          return (
            <Pressable
              key={w._id}
              style={[ad.assignOption, isSelected && ad.assignOptionActive]}
              onPress={() => { onSelect(job._id, w._id, w.name); onClose(); }}
            >
              <View style={[ad.assignAvatar, isSelected && { backgroundColor: '#f3eafd' }]}>
                <Text style={[ad.assignInitials, isSelected && { color: Colors.accent }]}>
                  {w.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ad.assignName, isSelected && { color: Colors.accent, fontWeight: '700' }]}>
                  {w.name}
                </Text>
                <Text style={ad.assignRole}>{w.role}</Text>
              </View>
              {isSelected && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
            </Pressable>
          );
        })}

        <Pressable style={ad.cancelBtn} onPress={onClose}>
          <Text style={ad.cancelBtnText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Admin job card ───────────────────────────────────────────────────────────
function AdminJobCard({
  job,
  onStatusPress,
  onAssignPress,
}: {
  job:           JobSummary;
  onStatusPress: (job: JobSummary) => void;
  onAssignPress: (job: JobSummary) => void;
}) {
  return (
    <View style={ad.card}>
      {/* Row 1: time + location + status */}
      <View style={ad.cardTopRow}>
        <View style={ad.timeBlock}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={ad.timeText}>{job.appointmentTime}</Text>
          <Ionicons
            name={job.locationType === 'mobile' ? 'navigate-outline' : 'business-outline'}
            size={12} color={Colors.textMuted}
            style={{ marginLeft: 6 }}
          />
          <Text style={ad.locText} numberOfLines={1}>
            {job.locationType === 'mobile'
              ? (job.mobileAddress || 'Mobile')
              : (job.bayLabel     || 'Bay')}
          </Text>
        </View>
        {/* Tappable badge → status picker */}
        <StatusBadge status={job.jobStatus} onPress={() => onStatusPress(job)} />
      </View>

      {/* Row 2: service name */}
      <Text style={ad.svcName} numberOfLines={1}>{job.serviceLabel}</Text>

      {/* Row 3: vehicle */}
      <View style={ad.vehicleRow}>
        <Ionicons name="car-outline" size={13} color={Colors.textMuted} />
        <Text style={ad.vehicleText} numberOfLines={1}>
          {job.vehicleLabel || 'No vehicle info'}
        </Text>
      </View>

      {/* Row 4: assignment + price */}
      <View style={ad.cardBottomRow}>
        {/* Tappable assignment chip → assign modal */}
        <Pressable style={ad.assignChip} onPress={() => onAssignPress(job)}>
          <Ionicons
            name={job.assignedStaffId ? 'person-circle-outline' : 'person-add-outline'}
            size={13}
            color={job.assignedStaffId ? Colors.accent : Colors.textMuted}
          />
          <Text
            style={[ad.assignChipText, job.assignedStaffId && { color: Colors.accent }]}
            numberOfLines={1}
          >
            {job.technicianName || 'Unassigned'}
          </Text>
          <Ionicons name="chevron-down" size={10} color={job.assignedStaffId ? Colors.accent : Colors.textMuted} />
        </Pressable>

        <View style={ad.priceBlock}>
          <Text style={ad.priceText}>${job.totalPrice.toFixed(2)}</Text>
          <Text style={ad.durText}>{job.durationMinutes}m</Text>
        </View>

        {/* Navigate to full workflow */}
        <Pressable
          style={ad.viewBtn}
          onPress={() => router.push({ pathname: '/(tabs)/jobs/[id]', params: { id: job._id } })}
        >
          <Text style={ad.viewBtnText}>View</Text>
          <Ionicons name="arrow-forward" size={12} color={Colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AdminJobManage() {
  const [date,          setDate]          = useState(todayISO());
  const [jobs,          setJobs]          = useState<JobSummary[]>([]);
  const [workers,       setWorkers]       = useState<Worker[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<JobStatus | 'all'>('all');
  const [workerFilter,  setWorkerFilter]  = useState<string>('all');
  const [statusTarget,  setStatusTarget]  = useState<JobSummary | null>(null);
  const [assignTarget,  setAssignTarget]  = useState<JobSummary | null>(null);

  // ── Fetch jobs ─────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<JobSummary[]>(`/api/jobs?date=${date}`);
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  // ── Fetch workers (once) ───────────────────────────────────────────────────
  const fetchWorkers = useCallback(async () => {
    try {
      const { data } = await axios.get<Worker[]>('/api/workers');
      setWorkers(data);
    } catch {
      setWorkers([]);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);
  useEffect(() => { fetchJobs(); },   [fetchJobs]);

  // Refresh when screen comes into focus
  useFocusEffect(useCallback(() => { fetchJobs(true); }, [fetchJobs]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs(true);
  }, [fetchJobs]);

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    // Optimistic update
    setJobs(prev =>
      prev.map(j => j._id === jobId ? { ...j, jobStatus: newStatus } : j)
    );
    try {
      await axios.patch(`/api/jobs/${jobId}/status`, { jobStatus: newStatus });
    } catch {
      fetchJobs(true); // rollback on error
    }
  };

  // ── Assignment ─────────────────────────────────────────────────────────────
  const handleAssign = async (jobId: string, staffId: string, name: string) => {
    setJobs(prev =>
      prev.map(j =>
        j._id === jobId
          ? { ...j, assignedStaffId: staffId || null, technicianName: name }
          : j
      )
    );
    try {
      if (staffId) {
        await axios.patch(`/api/jobs/${jobId}/assign`, { staffId, technicianName: name });
      } else {
        // Unassign: patch with empty staffId
        await axios.patch(`/api/jobs/${jobId}/assign`, { staffId: null, technicianName: '' });
      }
    } catch {
      fetchJobs(true);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = jobs;
    if (statusFilter !== 'all')  list = list.filter(j => j.jobStatus === statusFilter);
    if (workerFilter === 'unassigned') list = list.filter(j => !j.assignedStaffId);
    else if (workerFilter !== 'all')   list = list.filter(j => j.assignedStaffId === workerFilter);
    return list;
  }, [jobs, statusFilter, workerFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      jobs.length,
    active:     jobs.filter(j => j.jobStatus === 'in_progress').length,
    done:       jobs.filter(j => j.jobStatus === 'finished').length,
    unassigned: jobs.filter(j => !j.assignedStaffId).length,
    revenue:    jobs.reduce((s, j) => s + j.totalPrice, 0),
  }), [jobs]);

  const isToday = date === todayISO();

  return (
    <SafeAreaView style={ad.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={ad.header}>
        <Pressable style={ad.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={ad.headerTitle}>Job Management</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/fleet')} hitSlop={8}>
            <Ionicons name="navigate" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/queue')} hitSlop={8}>
            <Ionicons name="people-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/reports')} hitSlop={8}>
            <Ionicons name="bar-chart-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/inventory')} hitSlop={8}>
            <Ionicons name="cube-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/reviews')} hitSlop={8}>
            <Ionicons name="star-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/subscription-plans')} hitSlop={8}>
            <Ionicons name="card-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => router.push('/(tabs)/marketing')} hitSlop={8}>
            <Ionicons name="megaphone-outline" size={20} color={Colors.accent} />
          </Pressable>
          <Pressable style={[ad.refreshBtn, { backgroundColor: '#f3eafd' }]} onPress={() => router.push('/(tabs)/ai')} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: Colors.accent }}>✨</Text>
          </Pressable>
          <Pressable style={ad.refreshBtn} onPress={() => fetchJobs(true)} hitSlop={8}>
            <Ionicons name="refresh" size={20} color={Colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* ── Date navigation ── */}
      <View style={ad.datePicker}>
        <Pressable onPress={() => setDate(d => shiftISO(d, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: 'center' }}
          onPress={() => setDate(todayISO())}
        >
          <Text style={ad.dateText}>{formatDate(date)}</Text>
          {isToday && <Text style={ad.todayLabel}>Today — tap to reset</Text>}
        </Pressable>
        <Pressable onPress={() => setDate(d => shiftISO(d, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      {/* ── Stats row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ad.statsScroll}
        style={ad.statsRow}
      >
        {[
          { label: 'Total',      value: stats.total,              color: Colors.textPrimary },
          { label: 'Active',     value: stats.active,             color: Colors.warning },
          { label: 'Done',       value: stats.done,               color: Colors.success },
          { label: 'Unassigned', value: stats.unassigned,         color: Colors.error },
          { label: 'Revenue',    value: `$${stats.revenue.toFixed(0)}`, color: Colors.accent },
        ].map(s => (
          <View key={s.label} style={ad.statCard}>
            <Text style={[ad.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={ad.statLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Filter strip ── */}
      <View style={ad.filterSection}>
        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ad.filterScroll}
        >
          {[{ key: 'all', label: 'All' }, ...JOB_STEPS.map(s => ({ key: s.status, label: STAFF_STATUS_LABELS[s.status] }))].map(f => {
            const active = statusFilter === f.key;
            const col    = f.key !== 'all' ? STAFF_STATUS_COLORS[f.key as JobStatus] : null;
            return (
              <Pressable
                key={f.key}
                style={[
                  ad.filterPill,
                  active && { backgroundColor: col?.bg ?? '#f3eafd', borderColor: col?.text ?? Colors.accent },
                ]}
                onPress={() => setStatusFilter(f.key as JobStatus | 'all')}
              >
                <Text style={[ad.filterPillText, active && { color: col?.text ?? Colors.accent, fontWeight: '700' }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Worker filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[ad.filterScroll, { paddingTop: 6 }]}
        >
          {[
            { key: 'all',        label: 'All Staff'   },
            { key: 'unassigned', label: '⚠ Unassigned' },
            ...workers.map(w => ({ key: w._id, label: w.name })),
          ].map(f => {
            const active = workerFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[ad.filterPill, active && ad.filterPillWorkerActive]}
                onPress={() => setWorkerFilter(f.key)}
              >
                <Text style={[ad.filterPillText, active && ad.filterPillWorkerActiveText]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Job list ── */}
      {loading ? (
        <View style={ad.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={j => j._id}
          contentContainerStyle={ad.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListHeaderComponent={
            <Text style={ad.listCount}>
              {displayed.length} job{displayed.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' || workerFilter !== 'all' ? ' (filtered)' : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={ad.empty}>
              <Ionicons name="calendar-outline" size={52} color={Colors.border} />
              <Text style={ad.emptyTitle}>No jobs found</Text>
              <Text style={ad.emptyText}>
                {statusFilter !== 'all' || workerFilter !== 'all'
                  ? 'Try clearing your filters.'
                  : `No bookings on ${formatDate(date)}.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AdminJobCard
              job={item}
              onStatusPress={setStatusTarget}
              onAssignPress={setAssignTarget}
            />
          )}
        />
      )}

      {/* ── Modals ── */}
      <StatusPickerModal
        job={statusTarget}
        onSelect={handleStatusChange}
        onClose={() => setStatusTarget(null)}
      />
      <AssignModal
        job={assignTarget}
        workers={workers}
        onSelect={handleAssign}
        onClose={() => setAssignTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const ad = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  refreshBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Date picker
  datePicker: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    ...SHADOW,
  },
  dateText:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  todayLabel: { fontSize: 11, color: Colors.accent, fontWeight: '600', marginTop: 2 },

  // Stats
  statsRow:   { maxHeight: 82, marginBottom: 10 },
  statsScroll:{ paddingHorizontal: 16, gap: 10 },
  statCard:   {
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    alignItems: 'center', minWidth: 80,
    ...SHADOW,
  },
  statVal:    { fontSize: 20, fontWeight: '800' },
  statLabel:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // Filter
  filterSection: { marginBottom: 8 },
  filterScroll:  { paddingHorizontal: 16, gap: 8 },
  filterPill:    {
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterPillText:        { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterPillWorkerActive:{ backgroundColor: '#e8f4fd', borderColor: Colors.accent },
  filterPillWorkerActiveText: { color: Colors.accent, fontWeight: '700' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 110 },
  listCount:   { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginBottom: 10, marginTop: 4 },

  // Admin job card
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 15,
    marginBottom: 12, ...SHADOW,
  },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  timeBlock:   { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  timeText:    { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  locText:     { fontSize: 12, color: Colors.textMuted, flex: 1 },
  svcName:     { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 5 },
  vehicleRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  vehicleText: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  cardBottomRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 10 },

  // Assignment chip
  assignChip:     {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f7f7fb', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  assignChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, flex: 1 },

  priceBlock: { alignItems: 'flex-end' },
  priceText:  { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  durText:    { fontSize: 11, color: Colors.textMuted },

  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f3eafd', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  // Status badge (tappable version)
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Modal backdrop + sheet
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sheetSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },

  // Status options
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4,
  },
  statusDot:        { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },

  // Assign options
  assignOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4,
  },
  assignOptionActive: { backgroundColor: '#f3eafd' },
  assignAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  assignInitials: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  assignName:     { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  assignRole:     { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  cancelBtn: {
    marginTop: 8, backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
