// app/(tabs)/ai/index.tsx — Claude AI Hub
// Entry point for all three AI-powered admin features.
import { Ionicons } from '@expo/vector-icons';
import { router }   from 'expo-router';
import React from 'react';
import {
  Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

// ─── Feature card data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    route:       '/(tabs)/ai/schedule',
    icon:        'calendar-outline',
    color:       Colors.accent,
    bg:          '#f3eafd',
    title:       'Smart Scheduling',
    description: 'AI recommends the optimal time slot and best technician for a new booking based on current workload.',
    badge:       'Scheduling',
  },
  {
    route:       '/(tabs)/ai/insights',
    icon:        'bar-chart-outline',
    color:       Colors.accent,
    bg:          '#e8f4fd',
    title:       'Demand Insights',
    description: 'Analyse 90 days of bookings to identify peak hours, slow days, and get 3 staffing recommendations.',
    badge:       'Analytics',
  },
  {
    route:       '/(tabs)/ai/pricing',
    icon:        'pricetag-outline',
    color:       Colors.success,
    bg:          '#ecfdf5',
    title:       'Dynamic Pricing',
    description: 'Claude checks live queue depth vs. historical demand and suggests a surcharge or discount right now.',
    badge:       'Pricing',
  },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AIHubScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.title}>AI Assistant</Text>
            <Text style={s.sub}>Powered by Claude · Anthropic</Text>
          </View>
          {/* Claude logo placeholder */}
          <View style={s.claudeBadge}>
            <Text style={s.claudeInitial}>C</Text>
          </View>
        </View>

        {/* ── Info banner ── */}
        <View style={s.infoBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accent} />
          <Text style={s.infoText}>
            All AI requests route through your backend.
            Your Anthropic API key is never exposed to the app.
          </Text>
        </View>

        {/* ── Feature cards ── */}
        {FEATURES.map(f => (
          <Pressable
            key={f.route}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
            onPress={() => router.push(f.route as any)}
          >
            <View style={[s.cardIcon, { backgroundColor: f.bg }]}>
              <Ionicons name={f.icon as any} size={28} color={f.color} />
            </View>

            <View style={s.cardBody}>
              <View style={s.cardTopRow}>
                <Text style={s.cardTitle}>{f.title}</Text>
                <View style={[s.badgePill, { backgroundColor: f.bg }]}>
                  <Text style={[s.badgeText, { color: f.color }]}>{f.badge}</Text>
                </View>
              </View>
              <Text style={s.cardDesc}>{f.description}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={Colors.border} style={{ alignSelf: 'center' }} />
          </Pressable>
        ))}

        {/* ── Footer note ── */}
        <Text style={s.footer}>
          Recommendations are AI-generated suggestions.{'\n'}
          Always review before applying changes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 6,
  },
  backBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title:      { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  sub:        { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  claudeBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.warning,
    alignItems: 'center', justifyContent: 'center',
  },
  claudeInitial: { color: Colors.white, fontWeight: '900', fontSize: 18 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#f3eafd', borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.accent, lineHeight: 18 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: Colors.white, borderRadius: 18, padding: 18,
    ...SHADOW,
  },
  cardIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:   { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  cardDesc:   { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  badgePill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  footer: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 18, marginTop: 8,
  },
});
