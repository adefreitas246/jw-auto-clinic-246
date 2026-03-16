// app/(tabs)/marketing/index.tsx
// Marketing hub — four feature cards linking to sub-modules.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { ScreenHeader, StatCard } from '@/components/ui';

type Card = {
  icon:          React.ComponentProps<typeof Ionicons>['name'];
  label:         string;
  sub:           string;
  color:         string;
  bg:            string;
  route:         string;
  badge?:        string;
  sentThisMonth: number;
};

const CARDS: Card[] = [
  {
    icon:          'notifications-outline',
    label:         'Push Notifications',
    sub:           'Send campaigns to customers',
    color:         Colors.accent,
    bg:            Colors.accentMuted,
    route:         '/(tabs)/marketing/campaigns',
    sentThisMonth: 142,
  },
  {
    icon:          'ticket-outline',
    label:         'Coupons',
    sub:           'Create & track discount codes',
    color:         Colors.warning,
    bg:            Colors.warningBg,
    route:         '/(tabs)/marketing/coupons',
    sentThisMonth: 38,
  },
  {
    icon:          'chatbubble-outline',
    label:         'SMS',
    sub:           '24h appointment reminders',
    color:         Colors.success,
    bg:            Colors.successBg,
    route:         '/(tabs)/marketing/sms',
    badge:         'Setup required',
    sentThisMonth: 0,
  },
  {
    icon:          'mail-outline',
    label:         'Email',
    sub:           'Email marketing campaigns',
    color:         Colors.info,
    bg:            Colors.infoBg,
    route:         '/(tabs)/marketing/campaigns',
    sentThisMonth: 57,
  },
];

export default function MarketingIndex() {
  const router = useRouter();

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScreenHeader title="Marketing" />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats row */}
        <ReAnimated.View entering={FadeIn.duration(300)} style={st.statsRow}>
          <StatCard
            label="Sent"
            value="237"
            icon="send-outline"
            color={Colors.accent}
          />
          <StatCard
            label="Opened"
            value="61%"
            icon="eye-outline"
            color={Colors.success}
          />
          <StatCard
            label="Redeemed"
            value="24"
            icon="pricetag-outline"
            color={Colors.warning}
          />
        </ReAnimated.View>

        {/* Campaign type cards */}
        {CARDS.map((card, index) => (
          <ReAnimated.View
            key={card.route + card.label}
            entering={FadeInDown.delay(index * 80 + 100).springify()}
          >
            <View style={st.card}>
              {card.badge && (
                <View style={[st.badgePill, { backgroundColor: Colors.warningBg }]}>
                  <Text style={st.badgePillText}>{card.badge}</Text>
                </View>
              )}

              <View style={st.cardInner}>
                {/* Icon circle */}
                <View style={[st.iconCircle, { backgroundColor: Colors.accentMuted }]}>
                  <Ionicons name={card.icon} size={24} color={card.color} />
                </View>

                {/* Content */}
                <View style={st.cardContent}>
                  <Text style={st.cardTitle}>{card.label}</Text>
                  <Text style={st.cardSub}>{card.sub}</Text>
                  <Text style={[st.sentLabel, { color: card.color }]}>
                    {card.sentThisMonth} sent this month
                  </Text>
                </View>

                {/* Arrow + create button */}
                <View style={st.cardRight}>
                  <Pressable
                    style={[st.createBtn, { borderColor: card.color }]}
                    onPress={() => router.push(card.route as any)}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    <Text style={[st.createBtnText, { color: card.color }]}>Create</Text>
                  </Pressable>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} style={{ marginTop: 8 }} />
                </View>
              </View>
            </View>
          </ReAnimated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: 100 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  // Campaign card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
    overflow: 'hidden',
  },
  badgePill: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 10,
  },
  badgePillText: { fontSize: 10, fontWeight: '700', color: Colors.warningText },

  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle:   { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:     { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  sentLabel:   { fontSize: 12, fontWeight: '600' },

  cardRight: { alignItems: 'flex-end' },
  createBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 6,
    overflow: 'hidden',
  },
  createBtnText: { fontSize: 12, fontWeight: '700' },
});
