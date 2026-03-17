// app/(customer)/home.tsx
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { useAuth } from '@/context/AuthContext';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { SectionHeader } from '@/components/ui';
import { Card } from '@/components/ui';

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
  const { user } = useAuth();
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
        <Animated.View entering={FadeIn.duration(300)}>
          {/* ── Header ── */}
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.greeting}>{greeting},</Text>
              <Text style={s.userName}>{firstName}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [s.avatarBtn, pressed && { opacity: 0.8 }]}
              onPress={() => {
                if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(customer)/settings');
              }}
              hitSlop={8}
              android_ripple={{ color: Colors.accent + '20', borderless: true }}
            >
              <Avatar name={firstName} size={44} />
            </Pressable>
          </View>

          {/* ── Hero card ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Pressable
              style={({ pressed }) => [s.hero, pressed && { opacity: 0.93 }]}
              onPress={() => {
                if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(customer)/book');
              }}
              android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: false }}
            >
              <View style={s.heroContent}>
                <View style={s.heroEyebrowRow}>
                  <View style={s.heroEyebrowDot} />
                  <Text style={s.heroEyebrow}>READY TO BOOK?</Text>
                </View>
                <Text style={s.heroTitle}>Browse Services{'\n'}& Packages</Text>
                <View style={s.heroCta}>
                  <Text style={s.heroCtaText}>Book a Wash</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                </View>
              </View>
              <Ionicons
                name="car-sport"
                size={90}
                color="rgba(255,255,255,0.10)"
                style={s.heroIcon}
              />
            </Pressable>
          </Animated.View>

          {/* ── Quick actions grid ── */}
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Quick Access</Text>
          </View>
          <View style={s.grid}>
            {QUICK_ACTIONS.map((action, index) => (
              <Animated.View
                key={action.route}
                entering={FadeInDown.delay((index + 2) * 80).duration(300)}
                style={s.cardWrapper}
              >
                <Card
                  variant="default"
                  onPress={() => {
                    if (IS_IOS) Haptics.selectionAsync();
                    router.push(action.route as any);
                  }}
                  style={s.cardInner}
                  padding={16}
                >
                  <View style={[s.cardIcon, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={s.cardLabel}>{action.label}</Text>
                  <Text style={s.cardSub}>{action.sub}</Text>
                </Card>
              </Animated.View>
            ))}
          </View>

          {/* ── Section header placeholder ── */}
          <Animated.View entering={FadeInDown.delay(560).duration(300)}>
            <SectionHeader title="Recent Activity" actionLabel="See All" onAction={() => router.push('/(customer)/home')} />
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: SCROLL_PADDING_BOTTOM,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  userName: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  avatarBtn: {
    borderRadius: 24,
  },

  // Hero card
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: borderRadius.xl ?? borderRadius.lg,
    padding: 24,
    marginBottom: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...cardShadow,
  },
  heroContent: { flex: 1 },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  heroEyebrow: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 30,
    marginBottom: 18,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.full ?? 999,
  },
  heroCtaText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  heroIcon: { position: 'absolute', right: -12, bottom: -14 },

  // Grid
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  cardWrapper: {
    width: '47%',
  },
  cardInner: {
    width: '100%',
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardSub: { fontSize: 12, color: Colors.textSecondary },
});
