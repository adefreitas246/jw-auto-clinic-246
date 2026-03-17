// app/(tabs)/ai/index.tsx — Claude AI Hub
// Entry point for all three AI-powered admin features.
import { Ionicons } from '@expo/vector-icons';
import { router }   from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING, borderRadius, cardShadow } from '@/utils/platformStyles';
import { ScreenHeader, SectionHeader } from '@/components/ui';

// ─── Feature card data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    route:       '/(tabs)/ai/insights',
    icon:        'trending-up',
    color:       Colors.success,
    bg:          Colors.successBg,
    title:       'Revenue Insights',
    description: 'Analyse booking trends and revenue patterns.',
  },
  {
    route:       '/(tabs)/ai/pricing',
    icon:        'pricetag-outline',
    color:       Colors.accent,
    bg:          Colors.accentMuted,
    title:       'Smart Pricing',
    description: 'Dynamic surcharge and discount suggestions.',
  },
  {
    route:       '/(tabs)/ai/schedule',
    icon:        'calendar-outline',
    color:       Colors.warning,
    bg:          Colors.warningBg,
    title:       'Schedule Help',
    description: 'AI-optimized slot and technician assignment.',
  },
  {
    route:       '/(tabs)/ai/insights',
    icon:        'bar-chart-outline',
    color:       Colors.info,
    bg:          Colors.infoBg,
    title:       'Performance',
    description: 'Staff ratings, peak hours, and slow days.',
  },
] as const;

const RECENT_QUERIES = [
  { id: '1', icon: 'trending-up',    text: 'Revenue summary for last 30 days' },
  { id: '2', icon: 'calendar-outline', text: 'Best time slots for weekend bookings' },
  { id: '3', icon: 'pricetag-outline', text: 'Should I raise prices on Saturdays?' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AIHubScreen() {
  const [query, setQuery] = React.useState('');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="AI Assistant" subtitle="Powered by Wash Hub AI" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero card with LinearGradient ── */}
        <ReAnimated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <Ionicons name="sparkles" size={40} color={Colors.white} style={{ marginBottom: 12 }} />
            <Text style={s.heroTitle}>Ask me anything</Text>
            <Text style={s.heroSub}>
              Get insights, pricing suggestions, and scheduling help
            </Text>
          </LinearGradient>
        </ReAnimated.View>

        {/* ── Quick action grid (2x2) ── */}
        <ReAnimated.View entering={FadeInDown.delay(100).springify()} style={s.gridWrap}>
          <View style={s.grid}>
            {FEATURES.map((f, index) => (
              <Pressable
                key={f.route + f.title}
                style={({ pressed }) => [s.gridCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push(f.route as any)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <View style={[s.gridIconCircle, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.color} />
                </View>
                <Text style={s.gridCardTitle}>{f.title}</Text>
                <Text style={s.gridCardSub} numberOfLines={2}>{f.description}</Text>
              </Pressable>
            ))}
          </View>
        </ReAnimated.View>

        {/* ── Recent queries ── */}
        <ReAnimated.View entering={FadeInDown.delay(200).springify()}>
          <SectionHeader title="Recent" />
          <View style={s.recentList}>
            {RECENT_QUERIES.map((q, i) => (
              <Pressable
                key={q.id}
                style={s.recentRow}
                onPress={() => router.push('/(tabs)/ai/schedule' as any)}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                <View style={s.recentIconWrap}>
                  <Ionicons name={q.icon as any} size={16} color={Colors.accent} />
                </View>
                <Text style={s.recentText} numberOfLines={1}>{q.text}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.border} />
              </Pressable>
            ))}
          </View>
        </ReAnimated.View>

        {/* ── Ask input ── */}
        <ReAnimated.View entering={FadeInDown.delay(300).springify()} style={s.inputWrap}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Ask a question…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (query.trim()) router.push('/(tabs)/ai/schedule' as any);
              }}
            />
            <Pressable
              style={[s.sendBtn, !query.trim() && s.sendBtnDisabled]}
              onPress={() => {
                if (query.trim()) router.push('/(tabs)/ai/schedule' as any);
              }}
              disabled={!query.trim()}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
            >
              <Ionicons name="send" size={18} color={query.trim() ? Colors.white : Colors.textMuted} />
            </Pressable>
          </View>
        </ReAnimated.View>

        {/* Footer note */}
        <Text style={s.footer}>
          Recommendations are AI-generated suggestions.{'\n'}
          Always review before applying changes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = IS_IOS
  ? { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }
  : IS_ANDROID ? { elevation: 2 } : {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { padding: SCREEN_PADDING, paddingBottom: SCROLL_PADDING_BOTTOM, gap: 16 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...SHADOW,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  heroSub:   { fontSize: 14, color: Colors.white, opacity: 0.8, textAlign: 'center', lineHeight: 20 },

  // Grid
  gridWrap: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...SHADOW,
  },
  gridIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  gridCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  gridCardSub:   { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // Recent queries
  recentList: { gap: 6 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...SHADOW,
  },
  recentIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  recentText: { flex: 1, fontSize: 14, color: Colors.textSecondary },

  // Input bar
  inputWrap: {},
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    ...SHADOW,
  },
  input: {
    flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceAlt },

  footer: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 18,
  },
});
