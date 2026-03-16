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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

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
const CHART = W - 40;

const CHART_BASE = {
  backgroundGradientFrom: Colors.white,
  backgroundGradientTo:   Colors.white,
  decimalPlaces:          0,
  color:          (op = 1) => `rgba(14, 165, 233, ${op})`,
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
  const now   = new Date();
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
  const day = new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
  return day.slice(0, 3);
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={rd.sectionRow}>
      <View style={rd.sectionIconWrap}>
        <Ionicons name={icon as any} size={13} color={Colors.accent} />
      </View>
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

  const now = new Date();
  const periodLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={rd.safe} edges={['top']}>
      {loading ? (
        <View style={rd.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={rd.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {/* ── Gradient header ── */}
          <Animated.View entering={FadeIn.duration(400)}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={rd.gradientHeader}
            >
              <View style={rd.gradientHeaderRow}>
                <View>
                  <Text style={rd.gradientTitle}>Reports</Text>
                  <Text style={rd.gradientSub}>Admin Dashboard</Text>
                </View>
                <View style={rd.headerRight}>
                  <View style={rd.periodBadge}>
                    <Text style={rd.periodBadgeText}>{periodLabel}</Text>
                  </View>
                  <Pressable
                    onPress={() => fetch(false)}
                    style={rd.refreshBtn}
                    hitSlop={8}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    <Ionicons name="refresh" size={20} color={Colors.white} />
                  </Pressable>
                </View>
              </View>

              {/* 2x2 stat grid */}
              <View style={rd.kpiGrid}>
                {[
                  { label: "Today's Revenue", value: fmtMoney(data?.todayRevenue ?? 0), icon: 'today-outline', color: Colors.white },
                  { label: 'Total Revenue',   value: fmtMoney(data?.totalRevenue ?? 0), icon: 'cash-outline',  color: Colors.white },
                  { label: 'Staff On-clock',  value: String(data?.activeNow ?? 0),       icon: 'people-outline', color: Colors.white },
                  { label: 'All-time Jobs',   value: String(data?.totalServices ?? 0),   icon: 'layers-outline', color: Colors.white },
                ].map((kpi, i) => (
                  <View key={i} style={rd.kpiCard}>
                    <View style={rd.kpiIconWrap}>
                      <Ionicons name={kpi.icon as any} size={16} color={Colors.primary} />
                    </View>
                    <Text style={rd.kpiValue}>{kpi.value}</Text>
                    <Text style={rd.kpiLabel}>{kpi.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Bar chart: 7-day ── */}
          {barData && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={rd.chartCard}>
              <SectionLabel title="Last 7 Days — Daily Revenue" icon="bar-chart-outline" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={barData}
                  width={Math.max(CHART, 280)}
                  height={180}
                  chartConfig={{ ...CHART_BASE, barPercentage: 0.65 }}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  fromZero
                  showValuesOnTopOfBars
                  style={rd.chart}
                  withHorizontalLabels
                  withInnerLines
                />
              </ScrollView>
            </Animated.View>
          )}

          {/* ── Line chart: 4-week ── */}
          {lineData && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)} style={rd.chartCard}>
              <SectionLabel title="Weekly Revenue Trend (4 Weeks)" icon="trending-up-outline" />
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
            </Animated.View>
          )}

          {/* ── Pie chart: top services ── */}
          {pieData && pieData.length > 0 && (
            <Animated.View entering={FadeInDown.delay(260).duration(400)} style={rd.chartCard}>
              <SectionLabel title="Top Services by Revenue" icon="pie-chart-outline" />
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
            </Animated.View>
          )}

          {/* ── Service legend list ── */}
          {data?.serviceChart && data.serviceChart.length > 0 && (
            <Animated.View entering={FadeInDown.delay(320).duration(400)} style={rd.chartCard}>
              <SectionLabel title="Service Revenue Breakdown" icon="list-outline" />
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
            </Animated.View>
          )}

          {/* ── Report cards ── */}
          <SectionLabel title="Detailed Reports" icon="document-text-outline" />
          {REPORT_CARDS.map((card, i) => (
            <Animated.View key={card.type} entering={FadeInDown.delay(380 + i * 70).duration(350)}>
              <Pressable
                style={({ pressed }) => [rd.reportCard, pressed && IS_IOS && { opacity: 0.85 }]}
                onPress={() => openReport(card.type)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <View style={[rd.reportIconCircle, { backgroundColor: card.color + '18' }]}>
                  <Ionicons name={card.icon as any} size={22} color={card.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={rd.reportTitle}>{card.title}</Text>
                  <Text style={rd.reportDesc}>{card.desc}</Text>
                </View>
                <View style={rd.exportBadges}>
                  <View style={rd.badge}>
                    <Text style={rd.badgeText}>CSV</Text>
                  </View>
                  <View style={[rd.badge, rd.badgePdf]}>
                    <Text style={[rd.badgeText, { color: Colors.white }]}>PDF</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginLeft: 6 }} />
              </Pressable>
            </Animated.View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rd = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingBottom: 100 },

  // Gradient header
  gradientHeader: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: 24,
    marginBottom: 16,
  },
  gradientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gradientTitle: { fontSize: 26, fontWeight: '800', color: Colors.white },
  gradientSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodBadge:   { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  periodBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.white },
  refreshBtn:    { padding: 6 },

  // 2x2 KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '47.5%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    ...( IS_IOS
      ? { shadowColor: Colors.black, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
      : { elevation: 3 }),
  },
  kpiIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  kpiLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  // Section
  sectionRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8, paddingHorizontal: SCREEN_PADDING },
  sectionIconWrap: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Charts
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: SCREEN_PADDING,
    ...cardShadow,
  },
  chart: { borderRadius: 10, marginTop: 12 },

  // Horizontal bar list
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { fontSize: 12, color: Colors.textSecondary, width: 100 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill:  { height: 6, borderRadius: 3 },
  barValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, width: 68, textAlign: 'right' },

  // Report cards
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: SCREEN_PADDING,
    overflow: 'hidden',
    ...cardShadow,
  },
  reportIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  reportDesc:  { fontSize: 13, color: Colors.textMuted, lineHeight: 17 },

  exportBadges: { flexDirection: 'row', gap: 4 },
  badge: {
    borderRadius: 6,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgePdf:  { backgroundColor: Colors.error },
  badgeText: { fontSize: 9, fontWeight: '800', color: Colors.success, letterSpacing: 0.3 },
});
