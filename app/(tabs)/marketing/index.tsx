// app/(tabs)/marketing/index.tsx
// Marketing hub — four feature cards linking to sub-modules.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

type Card = {
  icon:    React.ComponentProps<typeof Ionicons>['name'];
  label:   string;
  sub:     string;
  color:   string;
  bg:      string;
  route:   string;
  badge?:  string;
};

const CARDS: Card[] = [
  {
    icon:  'megaphone-outline',
    label: 'Broadcast Push',
    sub:   'Send campaigns to customers',
    color: Colors.accent,
    bg:    Colors.accentMuted,
    route: '/(tabs)/marketing/campaigns',
  },
  {
    icon:  'pricetag-outline',
    label: 'Coupon Codes',
    sub:   'Create & track discount codes',
    color: Colors.accent,
    bg:    Colors.accentMuted,
    route: '/(tabs)/marketing/coupons',
  },
  {
    icon:  'chatbox-ellipses-outline',
    label: 'SMS Reminders',
    sub:   '24h appointment reminders',
    color: Colors.success,
    bg:    Colors.successBg,
    route: '/(tabs)/marketing/sms',
    badge: 'Setup required',
  },
  {
    icon:  'people-circle-outline',
    label: 'Referral Program',
    sub:   'Track customer referrals',
    color: Colors.warning,
    bg:    Colors.warningBg,
    route: '/(tabs)/marketing/referrals',
  },
];

export default function MarketingIndex() {
  const router = useRouter();

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>Marketing Tools</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={st.intro}>
          Engage customers, drive repeat visits, and grow your wash business.
        </Text>

        <View style={st.grid}>
          {CARDS.map(card => (
            <Pressable
              key={card.route}
              style={({ pressed }) => [st.card, { backgroundColor: card.bg }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(card.route as any)}
            >
              {card.badge && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{card.badge}</Text>
                </View>
              )}
              <View style={[st.iconWrap, { backgroundColor: card.color + '22' }]}>
                <Ionicons name={card.icon} size={28} color={card.color} />
              </View>
              <Text style={[st.cardLabel, { color: card.color }]}>{card.label}</Text>
              <Text style={st.cardSub}>{card.sub}</Text>
              <View style={st.cardArrow}>
                <Ionicons name="arrow-forward" size={14} color={card.color} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.surfaceAlt },
  scroll: { padding: 16 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.surfaceAlt },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  intro: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 21 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', borderRadius: 16, padding: 16,
    shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap:  { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  cardSub:   { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  cardArrow: { marginTop: 10 },
  badge:     { position: 'absolute', top: 10, right: 10, backgroundColor: Colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },
});
