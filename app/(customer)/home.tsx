// app/(customer)/home.tsx
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
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
    color: '#6a0dad',
    bg: '#f3eafd',
    route: '/(customer)/catalog',
  },
  {
    icon: 'car',
    label: 'My Vehicles',
    sub: 'Manage saved cars',
    color: '#0077cc',
    bg: '#e8f4fd',
    route: '/(customer)/vehicles',
  },
  {
    icon: 'gift-outline',
    label: 'Loyalty Rewards',
    sub: 'Points & milestones',
    color: '#f59e0b',
    bg: '#fffbeb',
    route: '/(customer)/loyalty',
  },
  {
    icon: 'card-outline',
    label: 'Subscriptions',
    sub: 'Monthly wash plans',
    color: '#10b981',
    bg: '#ecfdf5',
    route: '/(customer)/subscriptions',
  },
  {
    icon: 'people-circle-outline',
    label: 'Refer a Friend',
    sub: 'Share code & earn points',
    color: '#0077cc',
    bg: '#e8f4fd',
    route: '/(customer)/referral',
  },
];

export default function CustomerHome() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const firstName = user?.name?.split(' ')[0] ?? 'there';

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
            <Text style={s.greeting}>Hello, {firstName} 👋</Text>
            <Text style={s.sub}>What would you like to do today?</Text>
          </View>
          <Pressable
            style={s.avatarBtn}
            onPress={async () => { await logout(); router.replace('/auth/login'); }}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color="#6a0dad" />
          </Pressable>
        </View>

        {/* ── Hero card ── */}
        <Pressable
          style={({ pressed }) => [s.hero, pressed && { opacity: 0.92 }]}
          onPress={() => router.push('/(customer)/book')}
        >
          <View style={s.heroContent}>
            <Text style={s.heroEyebrow}>Ready to book?</Text>
            <Text style={s.heroTitle}>Browse Services{'\n'}& Packages</Text>
            <View style={s.heroCta}>
              <Text style={s.heroCtaText}>Book a Wash</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </View>
          <Ionicons name="car-sport" size={80} color="rgba(255,255,255,0.15)" style={s.heroIcon} />
        </Pressable>

        {/* ── Quick actions ── */}
        <Text style={s.sectionTitle}>Quick Access</Text>
        <View style={s.grid}>
          {QUICK_ACTIONS.map(action => (
            <Pressable
              key={action.route}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[s.cardIcon, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon} size={26} color={action.color} />
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

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#1f1f1f' },
  sub:      { fontSize: 14, color: '#888', marginTop: 2 },
  avatarBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f3eafd',
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero card
  hero: {
    backgroundColor: '#6a0dad',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  heroContent: { flex: 1 },
  heroEyebrow: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  heroTitle:   { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28, marginBottom: 16 },
  heroCta:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  heroCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroIcon:    { position: 'absolute', right: -8, bottom: -10 },

  // Quick actions grid
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f1f1f', marginBottom: 14 },
  grid: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: '#1f1f1f', marginBottom: 2 },
  cardSub:   { fontSize: 12, color: '#888' },
});
