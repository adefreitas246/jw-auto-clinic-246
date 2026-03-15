// app/(tabs)/reports/[type].tsx — Report Viewer + CSV & PDF Export
//
// Reads ?type=revenue|employees|customers|services + ?startDate + ?endDate
// from route params. Shows a scrollable data table (horizontal scroll) and
// exports via expo-file-system + expo-sharing.
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Colors } from '@/constants/Colors';

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key:     string;
  label:   string;
  width:   number;
  align?:  'left' | 'right' | 'center';
  fmt?:    (v: any) => string;
}

const money = (v: any) => `$${(Number(v) || 0).toFixed(2)}`;
const num   = (v: any) => String(Number(v) || 0);

// ── Report config ─────────────────────────────────────────────────────────────

interface ReportConfig {
  title:     string;
  icon:      string;
  endpoint:  string;
  columns:   ColDef[];
  /** Extract the rows array from the API response */
  getRows:   (data: any) => any[];
  /** Optional summary stats to display above the table */
  getStats?: (data: any) => { label: string; value: string }[];
}

const CONFIGS: Record<string, ReportConfig> = {
  revenue: {
    title:    'Revenue Report',
    icon:     'cash-outline',
    endpoint: '/api/reports/revenue',
    getRows:  d => d.rows ?? [],
    getStats: d => [
      { label: 'Total Revenue',  value: money(d.summary?.totalRevenue) },
      { label: 'Total Jobs',     value: num(d.summary?.totalJobs) },
      { label: 'Avg / Job',      value: money(d.summary?.avgPerJob) },
      { label: 'Total Discount', value: money(d.summary?.totalDiscount) },
    ],
    columns: [
      { key: 'date',           label: 'Date',           width: 96  },
      { key: 'customerName',   label: 'Customer',       width: 140 },
      { key: 'vehicleDetails', label: 'Vehicle',        width: 140 },
      { key: 'serviceType',    label: 'Service',        width: 140 },
      { key: 'originalPrice',  label: 'Original',       width: 80,  align: 'right', fmt: money },
      { key: 'discountLabel',  label: 'Discount',       width: 90  },
      { key: 'finalPrice',     label: 'Final',          width: 80,  align: 'right', fmt: money },
      { key: 'paymentMethod',  label: 'Payment',        width: 90  },
    ],
  },

  employees: {
    title:    'Employee Performance',
    icon:     'people-outline',
    endpoint: '/api/reports/employees',
    getRows:  d => d,
    getStats: d => {
      const rows = Array.isArray(d) ? d : [];
      const total  = rows.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
      const topStaff = rows[0];
      return [
        { label: 'Staff Listed',  value: num(rows.length) },
        { label: 'Total Revenue', value: money(total) },
        { label: 'Top Earner',    value: topStaff?.name ?? '—' },
      ];
    },
    columns: [
      { key: 'name',         label: 'Name',          width: 140 },
      { key: 'role',         label: 'Role',          width: 70  },
      { key: 'totalJobs',    label: 'Total Jobs',    width: 80,  align: 'right' },
      { key: 'transactions', label: 'Transactions',  width: 100, align: 'right' },
      { key: 'bookings',     label: 'Bookings',      width: 80,  align: 'right' },
      { key: 'revenue',      label: 'Revenue',       width: 90,  align: 'right', fmt: money },
      { key: 'avgDuration',  label: 'Avg Min',       width: 70,  align: 'right' },
    ],
  },

  customers: {
    title:    'Customer List',
    icon:     'person-outline',
    endpoint: '/api/reports/customers',
    getRows:  d => d,
    getStats: d => {
      const rows = Array.isArray(d) ? d : [];
      const total = rows.reduce((s: number, r: any) => s + (r.totalSpend || 0), 0);
      return [
        { label: 'Total Customers', value: num(rows.length) },
        { label: 'Total Spend',     value: money(total) },
        { label: 'Active (>0)',     value: num(rows.filter((r: any) => r.visits > 0).length) },
      ];
    },
    columns: [
      { key: 'code',       label: 'Code',    width: 90  },
      { key: 'name',       label: 'Name',    width: 150 },
      { key: 'phone',      label: 'Phone',   width: 110 },
      { key: 'vehicle',    label: 'Vehicle', width: 150 },
      { key: 'visits',     label: 'Visits',  width: 60,  align: 'right' },
      { key: 'totalSpend', label: 'Spent',   width: 80,  align: 'right', fmt: money },
      { key: 'lastVisit',  label: 'Last',    width: 90  },
      { key: 'discount',   label: 'Disc%',   width: 60,  align: 'right' },
    ],
  },

  services: {
    title:    'Service Analytics',
    icon:     'car-sport-outline',
    endpoint: '/api/reports/services',
    getRows:  d => d,
    getStats: d => {
      const rows = Array.isArray(d) ? d : [];
      const total  = rows.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
      const saved  = rows.reduce((s: number, r: any) => s + (r.discountSaved || 0), 0);
      return [
        { label: 'Service Types',   value: num(rows.length) },
        { label: 'Total Revenue',   value: money(total) },
        { label: 'Discount Given',  value: money(saved) },
      ];
    },
    columns: [
      { key: 'serviceType',   label: 'Service',        width: 180 },
      { key: 'count',         label: 'Count',          width: 60,  align: 'right' },
      { key: 'revenue',       label: 'Revenue',        width: 90,  align: 'right', fmt: money },
      { key: 'avgPrice',      label: 'Avg Price',      width: 80,  align: 'right', fmt: money },
      { key: 'totalOriginal', label: 'Original Total', width: 100, align: 'right', fmt: money },
      { key: 'discountSaved', label: 'Discounted',     width: 90,  align: 'right', fmt: money },
    ],
  },
};

// ── CSV builder ───────────────────────────────────────────────────────────────

function buildCsv(columns: ColDef[], rows: any[]): string {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(c => esc(c.label)).join(',');
  const body   = rows.map(row =>
    columns.map(c => {
      const raw = row[c.key] ?? '';
      return esc(c.fmt ? c.fmt(raw) : raw);
    }).join(',')
  );
  return [header, ...body].join('\n');
}

// ── PDF HTML builder ──────────────────────────────────────────────────────────

function buildPdfHtml(
  title:      string,
  startDate:  string,
  endDate:    string,
  stats:      { label: string; value: string }[],
  columns:    ColDef[],
  rows:       any[],
): string {
  const now = new Date().toLocaleString();

  const statCells = stats.map(s =>
    `<div class="stat"><div class="sv">${s.value}</div><div class="sl">${s.label}</div></div>`
  ).join('');

  const headerCells = columns.map(c =>
    `<th style="text-align:${c.align ?? 'left'}">${c.label}</th>`
  ).join('');

  const dataRows = rows.map((row, i) => {
    const cells = columns.map(c => {
      const raw = row[c.key] ?? '';
      const val = c.fmt ? c.fmt(raw) : raw;
      return `<td style="text-align:${c.align ?? 'left'}">${val}</td>`;
    }).join('');
    return `<tr class="${i % 2 === 0 ? 'even' : ''}">${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 28px; color: #1f1f1f; font-size: 12px; }

    .header { border-bottom: 3px solid #6a0dad; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand  { font-size: 22px; font-weight: 800; color: #6a0dad; }
    .rtype  { font-size: 15px; font-weight: 700; color: #333; margin-top: 4px; }
    .range  { font-size: 11px; color: #888; }

    .stats  { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat   { flex: 1; min-width: 100px; background: #f3eafd; border-radius: 8px; padding: 10px 14px; }
    .sv     { font-size: 18px; font-weight: 800; color: #6a0dad; }
    .sl     { font-size: 10px; color: #666; margin-top: 2px; }

    table   { width: 100%; border-collapse: collapse; font-size: 11px; }
    th      { background: #6a0dad; color: #fff; padding: 7px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    td      { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    tr.even td { background: #faf9ff; }

    .footer { margin-top: 20px; font-size: 10px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Wash Hub</div>
      <div class="rtype">${title}</div>
      <div class="range">${startDate} → ${endDate}</div>
    </div>
    <div class="range" style="text-align:right">Generated ${now}<br/>${rows.length} record(s)</div>
  </div>

  <div class="stats">${statCells}</div>

  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${dataRows}</tbody>
  </table>

  <div class="footer">Wash Hub · Confidential · Do not distribute</div>
</body>
</html>`;
}

// ── Quick date presets ────────────────────────────────────────────────────────

type Preset = 'today' | 'week' | 'month' | 'custom';

function presetDates(p: Preset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (p === 'today') return { startDate: today, endDate: today };

  if (p === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { startDate: d.toISOString().slice(0, 10), endDate: today };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: today };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReportViewer() {
  const params = useLocalSearchParams<{
    type: string;
    startDate: string;
    endDate: string;
  }>();

  const type = params.type ?? 'revenue';
  const cfg  = CONFIGS[type] ?? CONFIGS.revenue;

  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(params.startDate ?? today);
  const [endDate,   setEndDate]   = useState(params.endDate   ?? today);
  const [preset,    setPreset]    = useState<Preset>('month');
  const [rawData,   setRawData]   = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [error,     setError]     = useState('');

  const rows  = rawData ? cfg.getRows(rawData)   : [];
  const stats = rawData && cfg.getStats ? cfg.getStats(rawData) : [];

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(cfg.endpoint, {
        params: { startDate, endDate },
      });
      setRawData(data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [cfg.endpoint, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // ── Apply preset ────────────────────────────────────────────────────────────

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const { startDate: s, endDate: e } = presetDates(p);
      setStartDate(s);
      setEndDate(e);
    }
  };

  // ── CSV export ──────────────────────────────────────────────────────────────

  const exportCsv = async () => {
    if (!rows.length) return;
    setExporting('csv');
    try {
      const csv  = buildCsv(cfg.columns, rows);
      const path = `${FileSystem.documentDirectory}${type}_${startDate}_${endDate}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType:    'text/csv',
        dialogTitle: `${cfg.title} — CSV`,
        UTI:         'public.comma-separated-values-text',
      });
    } catch (e: any) {
      setError(e.message ?? 'CSV export failed.');
    } finally {
      setExporting(null);
    }
  };

  // ── PDF export ──────────────────────────────────────────────────────────────

  const exportPdf = async () => {
    if (!rows.length) return;
    setExporting('pdf');
    try {
      const html = buildPdfHtml(cfg.title, startDate, endDate, stats, cfg.columns, rows);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      // Move to documentDirectory so the file is accessible after sharing
      const dest = `${FileSystem.documentDirectory}${type}_${startDate}_${endDate}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType:    'application/pdf',
        dialogTitle: `${cfg.title} — PDF`,
        UTI:         'com.adobe.pdf',
      });
    } catch (e: any) {
      setError(e.message ?? 'PDF export failed.');
    } finally {
      setExporting(null);
    }
  };

  // ── Table ───────────────────────────────────────────────────────────────────

  const tableWidth = cfg.columns.reduce((s, c) => s + c.width, 0) + 24;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={rv.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={rv.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={rv.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={rv.title} numberOfLines={1}>{cfg.title}</Text>
          <Text style={rv.sub}>{startDate} → {endDate}</Text>
        </View>
        <Pressable onPress={load} hitSlop={8} style={rv.refreshBtn} disabled={loading}>
          <Ionicons name="refresh" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={rv.scroll}
      >
        {/* ── Date range picker ── */}
        <View style={rv.filterCard}>
          {/* Preset chips */}
          <View style={rv.chipRow}>
            {(['today', 'week', 'month', 'custom'] as Preset[]).map(p => (
              <Pressable
                key={p}
                style={[rv.chip, preset === p && rv.chipActive]}
                onPress={() => applyPreset(p)}
              >
                <Text style={[rv.chipText, preset === p && rv.chipTextActive]}>
                  {p === 'today' ? 'Today'
                    : p === 'week'  ? '7 Days'
                    : p === 'month' ? 'This Month'
                    : 'Custom'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Date inputs (always visible for precision editing) */}
          <View style={rv.dateRow}>
            <View style={rv.dateField}>
              <Text style={rv.dateFieldLabel}>From</Text>
              <TextInput
                style={rv.dateInput}
                value={startDate}
                onChangeText={v => { setStartDate(v); setPreset('custom'); }}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.border} style={{ marginTop: 24 }} />
            <View style={rv.dateField}>
              <Text style={rv.dateFieldLabel}>To</Text>
              <TextInput
                style={rv.dateInput}
                value={endDate}
                onChangeText={v => { setEndDate(v); setPreset('custom'); }}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />
            </View>
            <Pressable style={rv.applyBtn} onPress={load}>
              <Text style={rv.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View style={rv.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={rv.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Summary stats ── */}
        {stats.length > 0 && !loading && (
          <View style={rv.statsRow}>
            {stats.map(s => (
              <View key={s.label} style={rv.statCard}>
                <Text style={rv.statValue}>{s.value}</Text>
                <Text style={rv.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Table or loader ── */}
        {loading ? (
          <View style={rv.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={rv.loadText}>Loading report…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={rv.centered}>
            <Ionicons name="document-outline" size={48} color={Colors.border} />
            <Text style={rv.emptyTitle}>No data</Text>
            <Text style={rv.emptyText}>No records found for this date range.</Text>
          </View>
        ) : (
          <View style={rv.tableWrap}>
            {/* Row count badge */}
            <View style={rv.tableHeader}>
              <Text style={rv.rowCount}>
                {rows.length} row{rows.length !== 1 ? 's' : ''} (preview up to 200)
              </Text>
            </View>

            {/* Horizontal scroll table */}
            <ScrollView horizontal showsHorizontalScrollIndicator style={rv.hScroll}>
              <View style={{ width: tableWidth }}>
                {/* Header row */}
                <View style={rv.thRow}>
                  {cfg.columns.map(c => (
                    <Text
                      key={c.key}
                      style={[rv.th, { width: c.width, textAlign: c.align ?? 'left' }]}
                      numberOfLines={1}
                    >
                      {c.label}
                    </Text>
                  ))}
                </View>

                {/* Data rows */}
                {rows.slice(0, 200).map((row: any, i: number) => (
                  <View key={row._id ?? i} style={[rv.tdRow, i % 2 === 0 && rv.tdEven]}>
                    {cfg.columns.map(c => {
                      const raw = row[c.key] ?? '';
                      const val = c.fmt ? c.fmt(raw) : String(raw);
                      return (
                        <Text
                          key={c.key}
                          style={[rv.td, { width: c.width, textAlign: c.align ?? 'left' }]}
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

            {rows.length > 200 && (
              <Text style={rv.truncNote}>
                Showing first 200 rows. Export for the full dataset.
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Export FABs ── */}
      {rows.length > 0 && !loading && (
        <View style={rv.exportRow}>
          <Pressable
            style={({ pressed }) => [rv.exportBtn, rv.csvBtn, pressed && { opacity: 0.8 }]}
            onPress={exportCsv}
            disabled={!!exporting}
          >
            {exporting === 'csv'
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Ionicons name="document-text-outline" size={18} color={Colors.white} />
            }
            <Text style={rv.exportBtnText}>
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [rv.exportBtn, rv.pdfBtn, pressed && { opacity: 0.8 }]}
            onPress={exportPdf}
            disabled={!!exporting}
          >
            {exporting === 'pdf'
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Ionicons name="document-attach-outline" size={18} color={Colors.white} />
            }
            <Text style={rv.exportBtnText}>
              {exporting === 'pdf' ? 'Generating…' : 'Export PDF'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const rv = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ alignItems: 'center', paddingTop: 48, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  backBtn:    { padding: 4 },
  refreshBtn: { padding: 6 },
  title:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sub:        { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  scroll: { paddingBottom: 40 },

  // Filter card
  filterCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, ...SHADOW,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 99, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipActive:     { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  chipText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.accent },

  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 4 },
  dateInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
  },
  applyBtn: {
    backgroundColor: Colors.accent, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  applyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.errorBg, borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  errorText: { fontSize: 13, color: Colors.error, flex: 1 },

  // Stats
  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginHorizontal: 16, marginBottom: 14,
  },
  statCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.accent, ...SHADOW,
    minWidth: 90, flex: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.accent },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Table
  tableWrap:   { marginHorizontal: 16 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowCount:    { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  hScroll:     { borderRadius: 12, ...SHADOW },
  thRow: {
    flexDirection: 'row', backgroundColor: Colors.accent,
    paddingVertical: 9, paddingHorizontal: 12,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
  },
  th: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.3, textTransform: 'uppercase' },

  tdRow:  { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.white },
  tdEven: { backgroundColor: Colors.surfaceAlt },
  td:     { fontSize: 12, color: Colors.textSecondary },

  truncNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Empty state
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 14, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: Colors.textMuted },
  loadText:   { fontSize: 13, color: Colors.textMuted, marginTop: 10 },

  // Export
  exportRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16, paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.background,
    ...Platform.select({ ios: { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } }, android: { elevation: 4 } }),
  },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  csvBtn:        { backgroundColor: Colors.success },
  pdfBtn:        { backgroundColor: Colors.error },
  exportBtnText: { fontSize: 14, fontWeight: '800', color: Colors.white },
});
