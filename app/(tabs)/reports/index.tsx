// app/(tabs)/reports/index.tsx — Admin Revenue Dashboard + Report Hub
//
// Sections:
//   • KPI cards: Today + All-time stats
//   • 7-day daily revenue bar chart
//   • 4-week weekly revenue line chart
//   • Top 5 services pie chart
//   • 5 report-type cards → navigate to /(tabs)/reports/[type]
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayPoint  { date: string; revenue: number; count: number }
interface WeekPoint { label: string; revenue: number; count: number }
interface SvcPoint  { name: string; revenue: number; count: number }

interface DashData {
  totalRevenue:      number;
  totalServices:     number;
  totalEmployees:    number;
  activeNow:         number;
  todayRevenue:      number;
  todayTransactions: number;
  dailyChart:        DayPoint[];
  weeklyChart:       WeekPoint[];
  serviceChart:      SvcPoint[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W     = Dimensions.get('window').width;
const CHART = W - 40;  // chart width (20px padding each side)

const CHART_BASE = {
  backgroundGradientFrom: Colors.white,
  backgroundGradientTo:   Colors.white,
  decimalPlaces:          0,
  color:          (op = 1) => `rgba(106, 13, 173, ${op})`,
  labelColor:     ()       => Colors.textMuted,
  propsForBackgroundLines: { stroke: Colors.surfaceAlt },
};

const PIE_PALETTE = [Colors.accent, Colors.accentLight, Colors.error, Colors.warning, Colors.success];

const REPORT_CARDS = [
  {
    type:  'revenue',
    title: 'Revenue Report',
    desc:  'Transaction-level breakdown with day/service aggregates.',
    icon:  'cash-outline',
    color: Colors.success,
  },
  {
    type:  'employees',
    title: 'Employee Performance',
    desc:  'Jobs completed, revenue generated, avg service time.',
    icon:  'people-outline',
    color: Colors.info,
  },
  {
    type:  'customers',
    title: 'Customer List',
    desc:  'Customer directory with visit counts and total spend.',
    icon:  'person-outline',
    color: Colors.warning,
  },
  {
    type:  'services',
    title: 'Service Analytics',
    desc:  'Service popularity, revenue per service, discount impact.',
    icon:  'car-sport-outline',
    color: Colors.error,
  },
] as const;

type ReportType = (typeof REPORT_CARDS)[number]['type'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate:   now.toISOString().slice(0, 10),
  };
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayLabel(iso: string): string {
  // Return 3-letter weekday abbreviation
  const day = new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
  return day.slice(0, 3);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub?: string; icon: string; color: string;
}) {
  return (
    <View style={[rd.kpiCard, { borderTopColor: color }]}>
      <View style={[rd.kpiIconWrap, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={rd.kpiValue}>{value}</Text>
      <Text style={rd.kpiLabel}>{label}</Text>
      {sub ? <Text style={rd.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={rd.sectionRow}>
      <Ionicons name={icon as any} size={15} color={Colors.accent} />
      <Text style={rd.sectionTitle}>{title}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReportsDashboard() {
  const { user } = useAuth();
  const [data,       setData]       = useState<DashData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: d } = await axios.get<DashData>('/api/reports/dashboard');
      setData(d);
    } catch { /* keep stale */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetch(true); }, [fetch]);

  const openReport = (type: ReportType) => {
    const { startDate, endDate } = monthRange();
    router.push({
      pathname: '/(tabs)/reports/[type]',
      params:   { type, startDate, endDate },
    });
  };

  // ── Chart data ──────────────────────────────────────────────────────────────

  const barData = data?.dailyChart?.length
    ? {
        labels:   data.dailyChart.map(d => dayLabel(d.date)),
        datasets: [{ data: data.dailyChart.map(d => Math.max(d.revenue, 0)) }],
      }
    : null;

  const lineData = data?.weeklyChart?.length
    ? {
        labels:   data.weeklyChart.map(w => w.label),
        datasets: [{ data: data.weeklyChart.map(w => Math.max(w.revenue, 0)) }],
      }
    : null;

  const pieData = data?.serviceChart?.length
    ? data.serviceChart.slice(0, 5).map((s, i) => ({
        name:            s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
        population:      s.revenue,
        color:           PIE_PALETTE[i % PIE_PALETTE.length],
        legendFontColor: Colors.textSecondary,
        legendFontSize:  12,
      }))
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={rd.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={rd.header}>
        <View>
          <Text style={rd.title}>Reports</Text>
          <Text style={rd.sub}>Admin Dashboard</Text>
        </View>
        <Pressable onPress={() => fetch(false)} style={rd.refreshBtn} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={rd.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={rd.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
        >

          {/* ── KPI strip ── */}
          <SectionHeader title="Overview" icon="stats-chart-outline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={rd.kpiRow}>
              <KpiCard label="Today's Revenue"  value={fmtMoney(data?.todayRevenue ?? 0)}  icon="today-outline"         color={Colors.accent} sub={`${data?.todayTransactions ?? 0} jobs`} />
              <KpiCard label="Total Revenue"    value={fmtMoney(data?.totalRevenue ?? 0)}  icon="cash-outline"          color={Colors.success} sub={`${data?.totalServices ?? 0} all-time`} />
              <KpiCard label="Staff On-clock"   value={String(data?.activeNow ?? 0)}       icon="people-outline"        color={Colors.info} sub={`of ${data?.totalEmployees ?? 0} staff`} />
            </View>
          </ScrollView>

          {/* ── Bar chart: 7-day ── */}
          {barData && (
            <View style={rd.chartCard}>
              <SectionHeader title="Last 7 Days — Daily Revenue" icon="bar-chart-outline" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={barData}
                  width={Math.max(CHART, 280)}
                  height={180}
                  chartConfig={{
                    ...CHART_BASE,
                    barPercentage: 0.65,
                  }}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  fromZero
                  showValuesOnTopOfBars
                  style={rd.chart}
                  withHorizontalLabels
                  withInnerLines
                />
              </ScrollView>
            </View>
          )}

          {/* ── Line chart: 4-week ── */}
          {lineData && (
            <View style={rd.chartCard}>
              <SectionHeader title="Weekly Revenue Trend (4 Weeks)" icon="trending-up-outline" />
              <LineChart
                data={lineData}
                width={CHART}
                height={160}
                chartConfig={{
                  ...CHART_BASE,
                  propsForDots: { r: '5', strokeWidth: '2', stroke: Colors.accent },
                }}
                bezier
                style={rd.chart}
                yAxisLabel="$"
                yAxisSuffix=""
                withInnerLines
              />
            </View>
          )}

          {/* ── Pie chart: top services ── */}
          {pieData && pieData.length > 0 && (
            <View style={rd.chartCard}>
              <SectionHeader title="Top Services by Revenue" icon="pie-chart-outline" />
              <PieChart
                data={pieData}
                width={CHART}
                height={180}
                chartConfig={CHART_BASE}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                style={rd.chart}
                absolute={false}
              />
            </View>
          )}

          {/* ── Service legend list (if no pie or as supplement) ── */}
          {data?.serviceChart && data.serviceChart.length > 0 && (
            <View style={rd.chartCard}>
              <SectionHeader title="Service Revenue Breakdown" icon="list-outline" />
              {data.serviceChart.map((s, i) => {
                const maxRev = data.serviceChart[0].revenue || 1;
                return (
                  <View key={s.name} style={rd.barRow}>
                    <View style={[rd.colorDot, { backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }]} />
                    <Text style={rd.barLabel} numberOfLines={1}>{s.name}</Text>
                    <View style={rd.barTrack}>
                      <View
                        style={[
                          rd.barFill,
                          {
                            width:           `${Math.round((s.revenue / maxRev) * 100)}%`,
                            backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length],
                          },
                        ]}
                      />
                    </View>
                    <Text style={rd.barValue}>{fmtMoney(s.revenue)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Report cards ── */}
          <SectionHeader title="Detailed Reports" icon="document-text-outline" />
          {REPORT_CARDS.map(card => (
            <Pressable
              key={card.type}
              style={({ pressed }) => [rd.reportCard, pressed && { opacity: 0.85 }]}
              onPress={() => openReport(card.type)}
            >
              <View style={[rd.reportIcon, { backgroundColor: card.color + '18' }]}>
                <Ionicons name={card.icon as any} size={22} color={card.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={rd.reportTitle}>{card.title}</Text>
                <Text style={rd.reportDesc}>{card.desc}</Text>
              </View>
              <View style={rd.exportBadges}>
                <View style={rd.badge}><Text style={rd.badgeText}>CSV</Text></View>
                <View style={[rd.badge, rd.badgePdf]}><Text style={[rd.badgeText, { color: Colors.white }]}>PDF</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginLeft: 6 }} />
            </Pressable>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const rd = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  title:      { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  sub:        { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  refreshBtn: { padding: 6 },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  // Section
  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  sectionTitle:{ fontSize: 13, fontWeight: '700', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },

  // KPI
  kpiRow:   { flexDirection: 'row', gap: 12, paddingRight: 20 },
  kpiCard:  {
    width: 140, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, borderTopWidth: 3, ...SHADOW,
  },
  kpiIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  kpiLabel:    { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  kpiSub:      { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Charts
  chartCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 14, ...SHADOW },
  chart:     { borderRadius: 8, marginTop: 10 },

  // Horizontal bar list
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  colorDot:  { width: 8, height: 8, borderRadius: 4 },
  barLabel:  { fontSize: 12, color: Colors.textSecondary, width: 100 },
  barTrack:  { flex: 1, height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 6, borderRadius: 3 },
  barValue:  { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, width: 68, textAlign: 'right' },

  // Report cards
  reportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, marginBottom: 12, ...SHADOW,
  },
  reportIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  reportDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  exportBadges: { flexDirection: 'row', gap: 4 },
  badge:        { borderRadius: 6, backgroundColor: Colors.successBg, paddingHorizontal: 6, paddingVertical: 3 },
  badgePdf:     { backgroundColor: Colors.error },
  badgeText:    { fontSize: 9, fontWeight: '800', color: Colors.success, letterSpacing: 0.3 },
});
