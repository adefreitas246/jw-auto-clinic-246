// app/(customer)/home.tsx
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type QuickAction = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  color: string;
  bg: string;
  route: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: 'layers',
    label: 'Browse Services',
    sub: 'Packages & add-ons',
    color: Colors.accent,
    bg: Colors.accentMuted,
    route: '/(customer)/catalog',
  },
  {
    icon: 'car',
    label: 'My Vehicles',
    sub: 'Manage saved cars',
    color: Colors.info,
    bg: Colors.infoBg,
    route: '/(customer)/vehicles',
  },
  {
    icon: 'gift-outline',
    label: 'Loyalty Rewards',
    sub: 'Points & milestones',
    color: Colors.warning,
    bg: Colors.warningBg,
    route: '/(customer)/loyalty',
  },
  {
    icon: 'card-outline',
    label: 'Subscriptions',
    sub: 'Monthly wash plans',
    color: Colors.success,
    bg: Colors.successBg,
    route: '/(customer)/subscriptions',
  },
  {
    icon: 'people-circle-outline',
    label: 'Refer a Friend',
    sub: 'Share code & earn',
    color: Colors.info,
    bg: Colors.infoBg,
    route: '/(customer)/referral',
  },
];

export default function CustomerHome() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={s.sub}>What would you like to do today?</Text>
          </View>
          <Pressable
            style={s.avatarBtn}
            onPress={async () => { await logout(); router.replace('/auth/login'); }}
            hitSlop={8}
          >
            <Text style={s.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* ── Hero card ── */}
        <Pressable
          style={({ pressed }) => [s.hero, pressed && { opacity: 0.92 }]}
          onPress={() => router.push('/(customer)/book')}
        >
          <View style={s.heroContent}>
            <Text style={s.heroEyebrow}>READY TO BOOK?</Text>
            <Text style={s.heroTitle}>Browse Services{'\n'}& Packages</Text>
            <View style={s.heroCta}>
              <Text style={s.heroCtaText}>Book a Wash</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.white} />
            </View>
          </View>
          <Ionicons
            name="car-sport"
            size={80}
            color="rgba(255,255,255,0.12)"
            style={s.heroIcon}
          />
        </Pressable>

        {/* ── Quick actions grid ── */}
        <Text style={s.sectionTitle}>Quick Access</Text>
        <View style={s.grid}>
          {QUICK_ACTIONS.map(action => (
            <Pressable
              key={action.route}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[s.cardIcon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={s.cardLabel}>{action.label}</Text>
              <Text style={s.cardSub}>{action.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 3 },
  default: {},
});

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sub:      { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '800', fontSize: 16 },

  // Hero card
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  heroContent: { flex: 1 },
  heroEyebrow: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.white,
    lineHeight: 28, marginBottom: 16,
  },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99,
  },
  heroCtaText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  heroIcon:    { position: 'absolute', right: -8, bottom: -10 },

  // Grid
  sectionTitle: {
    fontSize: 18, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    ...shadow,
  },
  cardIcon:  { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:   { fontSize: 12, color: Colors.textSecondary },
});
