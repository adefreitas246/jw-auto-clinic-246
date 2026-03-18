// app/(tabs)/reports/index.tsx — Reports Dashboard
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LineChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

const W = Dimensions.get('window').width;
const CHART_W = W - SCREEN_PADDING * 2 - 32;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportData {
  totalRevenue:  number;
  totalBookings: number;
  avgJobValue:   number;
  completedRate: number;
  revenueChart:  { date: string; revenue: number }[];
  topServices:   { name: string; count: number; revenue: number }[];
  employees:     { name: string; jobs: number; avgTime: number; rating: number; revenue: number }[];
}

type Preset  = 'today' | 'week' | 'month' | 'custom';
type SortKey = 'name' | 'jobs' | 'avgTime' | 'rating' | 'revenue';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function presetRange(p: Preset): { from: Date; to: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p === 'today') return { from: new Date(today), to: new Date(today) };
  if (p === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from, to: new Date(today) };
  }
  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today) };
}

// ── Config ────────────────────────────────────────────────────────────────────

const CHART_CONFIG = {
  backgroundGradientFrom:    Colors.surface,
  backgroundGradientTo:      Colors.surface,
  decimalPlaces:             0,
  color:        (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
  labelColor:   ()             => Colors.textMuted,
  fillShadowGradient:        Colors.accentMuted,
  fillShadowGradientOpacity: 1,
  propsForBackgroundLines:   { stroke: Colors.border, strokeDasharray: '' },
  propsForLabels:            { fontSize: 10 },
};

const SUMMARY_CARDS = [
  { key: 'totalRevenue',  label: 'Total Revenue',  icon: 'cash-outline',            color: Colors.success, fmt: fmtMoney },
  { key: 'totalBookings', label: 'Total Bookings', icon: 'calendar-outline',         color: Colors.accent,  fmt: (v: number) => String(v) },
  { key: 'avgJobValue',   label: 'Avg Job Value',  icon: 'trending-up-outline',      color: Colors.warning, fmt: fmtMoney },
  { key: 'completedRate', label: 'Completed Rate', icon: 'checkmark-circle-outline', color: Colors.info,    fmt: (v: number) => `${v.toFixed(1)}%` },
] as const;

const EMP_COLS: { key: SortKey; label: string; width: number; align?: 'right'; fmt?: (v: any) => string }[] = [
  { key: 'name',    label: 'Staff',   width: 130 },
  { key: 'jobs',    label: 'Jobs',    width: 52,  align: 'right' },
  { key: 'avgTime', label: 'Avg min', width: 68,  align: 'right' },
  { key: 'rating',  label: 'Rating',  width: 60,  align: 'right', fmt: (v: number) => v.toFixed(1) },
  { key: 'revenue', label: 'Revenue', width: 88,  align: 'right', fmt: fmtMoney },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  // Date range
  const [preset,   setPreset]   = useState<Preset>('month');
  const [fromDate, setFromDate] = useState<Date>(() => presetRange('month').from);
  const [toDate,   setToDate]   = useState<Date>(() => presetRange('month').to);

  // Date picker
  const [pickerTarget,  setPickerTarget]  = useState<'from' | 'to' | null>(null);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(new Date());

  // Data
  const [data,      setData]      = useState<ReportData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports?from=${toISO(fromDate)}&to=${toISO(toDate)}`);
      if (!res.ok) throw new Error('Failed to load report');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useFocusEffect(useCallback(() => { loadReport(); }, [loadReport]));

  // ── Preset ────────────────────────────────────────────────────────────────

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const { from, to } = presetRange(p);
      setFromDate(from);
      setToDate(to);
    }
  };

  // ── Date picker ───────────────────────────────────────────────────────────

  const openPicker = (target: 'from' | 'to') => {
    setIosPickerDate(target === 'from' ? fromDate : toDate);
    setPickerTarget(target);
  };

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (date) {
      if (pickerTarget === 'from') setFromDate(date);
      else if (pickerTarget === 'to') setToDate(date);
      setPreset('custom');
      if (Platform.OS === 'ios') setIosPickerDate(date);
    }
  };

  const confirmIosPicker = () => {
    if (pickerTarget === 'from') setFromDate(iosPickerDate);
    else if (pickerTarget === 'to') setToDate(iosPickerDate);
    setPickerTarget(null);
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setExporting('csv');
    try {
      const res = await fetch(`/api/reports/csv?from=${toISO(fromDate)}&to=${toISO(toDate)}`);
      if (!res.ok) throw new Error('Server returned an error');
      const text = await res.text();
      const path = `${FileSystem.documentDirectory}report_${toISO(fromDate)}_${toISO(toDate)}.csv`;
      await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV Report',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message ?? 'Could not export CSV.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const url  = `/api/reports/pdf?from=${toISO(fromDate)}&to=${toISO(toDate)}`;
      const path = `${FileSystem.documentDirectory}report_${toISO(fromDate)}_${toISO(toDate)}.pdf`;
      const result = await FileSystem.downloadAsync(url, path);
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export PDF Report',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message ?? 'Could not export PDF.');
    } finally {
      setExporting(null);
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedEmployees = useMemo(() => {
    if (!data?.employees?.length) return [];
    return [...data.employees].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') {
        return sortAsc
          ? (av as string).localeCompare(bv as string)
          : (bv as string).localeCompare(av as string);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, sortKey, sortAsc]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const pts = data?.revenueChart ?? [];
    if (!pts.length) return null;
    const step = Math.max(1, Math.ceil(pts.length / 10));
    return {
      labels: pts.map((p, i) => {
        if (i % step !== 0) return '';
        const d = new Date(p.date + 'T12:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }),
      datasets: [{ data: pts.map(p => Math.max(p.revenue, 0)), strokeWidth: 2 }],
    };
  }, [data]);

  const topServices    = data?.topServices ?? [];
  const maxSvcRevenue  = topServices.length ? Math.max(...topServices.map(s => s.revenue), 1) : 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* iOS Date Picker Modal */}
      {Platform.OS === 'ios' && pickerTarget !== null && (
        <Modal transparent animationType="slide" onRequestClose={() => setPickerTarget(null)}>
          <View style={s.pickerOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPickerTarget(null)} />
            <View style={s.pickerSheet}>
              <View style={s.pickerToolbar}>
                <TouchableOpacity onPress={() => setPickerTarget(null)}>
                  <Text style={s.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.pickerSheetTitle}>
                  {pickerTarget === 'from' ? 'From Date' : 'To Date'}
                </Text>
                <TouchableOpacity onPress={confirmIosPicker}>
                  <Text style={s.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosPickerDate}
                mode="date"
                display="spinner"
                onChange={(_e, d) => { if (d) setIosPickerDate(d); }}
                maximumDate={new Date()}
                textColor={Colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Date Picker */}
      {Platform.OS === 'android' && pickerTarget !== null && (
        <DateTimePicker
          value={pickerTarget === 'from' ? fromDate : toDate}
          mode="date"
          display="default"
          onChange={onPickerChange}
          maximumDate={new Date()}
        />
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Reports</Text>
          <TouchableOpacity
            onPress={loadReport}
            disabled={loading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <Ionicons name="refresh-outline" size={22} color={Colors.accent} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Date Range Picker ── */}
        <View style={s.card}>
          <View style={s.chipRow}>
            {(['today', 'week', 'month', 'custom'] as Preset[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.chip, preset === p && s.chipActive]}
                onPress={() => applyPreset(p)}
              >
                <Text style={[s.chipText, preset === p && s.chipTextActive]}>
                  {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => openPicker('from')}>
              <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.dateBtnLabel}>From</Text>
                <Text style={s.dateBtnValue}>{fmtDate(fromDate)}</Text>
              </View>
            </TouchableOpacity>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <TouchableOpacity style={s.dateBtn} onPress={() => openPicker('to')}>
              <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.dateBtnLabel}>To</Text>
                <Text style={s.dateBtnValue}>{fmtDate(toDate)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.applyBtn}
              onPress={loadReport}
              disabled={loading}
            >
              <Text style={s.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Loading ── */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={s.loadingText}>Loading report…</Text>
          </View>
        ) : (
          <>
            {/* ── Summary Cards ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.summaryRow}
            >
              {SUMMARY_CARDS.map(card => (
                <View key={card.key} style={[s.summaryCard, { borderTopColor: card.color }]}>
                  <View style={[s.summaryIconWrap, { backgroundColor: card.color + '18' }]}>
                    <Ionicons name={card.icon as any} size={18} color={card.color} />
                  </View>
                  <Text style={[s.summaryValue, { color: card.color }]}>
                    {card.fmt((data as any)?.[card.key] ?? 0)}
                  </Text>
                  <Text style={s.summaryLabel}>{card.label}</Text>
                </View>
              ))}
            </ScrollView>

            {/* ── Revenue Line Chart ── */}
            {chartData && (
              <View style={s.card}>
                <View style={s.sectionHeader}>
                  <Ionicons name="trending-up-outline" size={16} color={Colors.accent} />
                  <Text style={s.sectionTitle}>Revenue Over Time</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <LineChart
                    data={chartData}
                    width={Math.max(CHART_W, chartData.labels.length * 44)}
                    height={180}
                    chartConfig={CHART_CONFIG}
                    bezier
                    withShadow
                    withInnerLines
                    withDots={chartData.labels.length <= 14}
                    yAxisLabel="$"
                    yAxisSuffix=""
                    style={{ borderRadius: borderRadius.md, marginTop: 8 }}
                  />
                </ScrollView>
              </View>
            )}

            {/* ── Top Services ── */}
            {topServices.length > 0 && (
              <View style={s.card}>
                <View style={s.sectionHeader}>
                  <Ionicons name="car-sport-outline" size={16} color={Colors.accent} />
                  <Text style={s.sectionTitle}>Top Services</Text>
                </View>
                <View style={s.svcHead}>
                  <Text style={[s.colHdr, { flex: 1 }]}>Service</Text>
                  <Text style={[s.colHdr, s.colRight, { width: 44 }]}>Jobs</Text>
                  <Text style={[s.colHdr, s.colRight, { width: 82 }]}>Revenue</Text>
                </View>
                {topServices.map((svc, i) => {
                  const pct = svc.revenue / maxSvcRevenue;
                  return (
                    <View key={svc.name + i} style={s.svcRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={s.svcName} numberOfLines={1}>{svc.name}</Text>
                        <View style={s.svcBarTrack}>
                          <View style={[s.svcBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                        </View>
                      </View>
                      <Text style={[s.svcCell, { width: 44 }]}>{svc.count}</Text>
                      <Text style={[s.svcCell, s.colRight, { width: 82 }]}>{fmtMoney(svc.revenue)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Export Buttons ── */}
            <View style={s.exportRow}>
              <TouchableOpacity
                style={[s.exportBtn, s.csvBtn, !!exporting && s.btnDisabled]}
                onPress={handleExportCsv}
                disabled={!!exporting}
              >
                {exporting === 'csv'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="document-text-outline" size={18} color="#fff" />
                }
                <Text style={s.exportBtnText}>
                  {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.exportBtn, s.pdfBtn, !!exporting && s.btnDisabled]}
                onPress={handleExportPdf}
                disabled={!!exporting}
              >
                {exporting === 'pdf'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="document-outline" size={18} color="#fff" />
                }
                <Text style={s.exportBtnText}>
                  {exporting === 'pdf' ? 'Generating…' : 'Export PDF'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Employee Performance Table ── */}
            {sortedEmployees.length > 0 && (
              <View style={s.card}>
                <View style={s.sectionHeader}>
                  <Ionicons name="people-outline" size={16} color={Colors.accent} />
                  <Text style={s.sectionTitle}>Employee Performance</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Column headers */}
                    <View style={s.empThRow}>
                      {EMP_COLS.map(col => (
                        <TouchableOpacity
                          key={col.key}
                          style={[s.empTh, { width: col.width }]}
                          onPress={() => toggleSort(col.key)}
                        >
                          <View style={[s.empThInner, col.align === 'right' && { justifyContent: 'flex-end' }]}>
                            <Text style={s.empThText} numberOfLines={1}>{col.label}</Text>
                            {sortKey === col.key && (
                              <Ionicons
                                name={sortAsc ? 'chevron-up' : 'chevron-down'}
                                size={10}
                                color={Colors.accentLight}
                                style={{ marginLeft: 3 }}
                              />
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Data rows */}
                    {sortedEmployees.map((emp, i) => (
                      <View key={emp.name + i} style={[s.empTdRow, i % 2 === 0 && s.empTdEven]}>
                        {EMP_COLS.map(col => {
                          const raw = emp[col.key];
                          const val = col.fmt ? col.fmt(raw) : String(raw ?? '');
                          return (
                            <Text
                              key={col.key}
                              style={[s.empTd, { width: col.width, textAlign: col.align ?? 'left' }]}
                              numberOfLines={1}
                            >
                              {val}
                            </Text>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },

  // Card wrapper
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 14,
    ...cardShadow,
  },

  // Date picker
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: {
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive:     { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  chipText:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.accent },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dateBtnLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  dateBtnValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  applyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Error / loading
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorBg,
    borderRadius: borderRadius.md,
    padding: 14,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText:   { fontSize: 13, color: Colors.error, flex: 1 },
  loadingBox:  { alignItems: 'center', paddingTop: 60, paddingBottom: 24 },
  loadingText: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },

  // Summary cards (horizontal scroll)
  summaryRow: { paddingHorizontal: SCREEN_PADDING, paddingTop: 14, gap: 10 },
  summaryCard: {
    width: 136,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderTopWidth: 3,
    ...cardShadow,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: Colors.textMuted },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Top services
  svcHead:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colHdr:      { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  colRight:    { textAlign: 'right' },
  svcRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  svcName:     { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  svcBarTrack: { height: 5, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  svcBarFill:  { height: 5, backgroundColor: Colors.accent, borderRadius: 3 },
  svcCell:     { fontSize: 13, color: Colors.textSecondary },

  // Export
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 14,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
  },
  csvBtn:        { backgroundColor: Colors.success },
  pdfBtn:        { backgroundColor: Colors.error },
  exportBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled:   { opacity: 0.55 },

  // Employee table
  empThRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
  },
  empTh:       { justifyContent: 'center' },
  empThInner:  { flexDirection: 'row', alignItems: 'center' },
  empThText:   { fontSize: 10, fontWeight: '700', color: Colors.white, textTransform: 'uppercase', letterSpacing: 0.4 },
  empTdRow:    { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Colors.surface },
  empTdEven:   { backgroundColor: Colors.surfaceAlt },
  empTd:       { fontSize: 13, color: Colors.textSecondary },

  // iOS date picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'flex-end' },
  pickerSheet:   { backgroundColor: Colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: 34 },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerSheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  pickerCancel:     { fontSize: 15, color: Colors.textMuted },
  pickerDone:       { fontSize: 15, fontWeight: '700', color: Colors.accent },
});
