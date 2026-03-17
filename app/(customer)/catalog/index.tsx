// app/(customer)/catalog/index.tsx
// Customer-facing service catalog.
// Search + category chips → Packages (Book This) + Individual services (Add).
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { useBooking } from '@/context/BookingContext';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Exterior', 'Interior', 'Detailing', 'Add-ons'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

// Maps API category strings → badge colors (all from Colors, no hardcoded hex)
const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  Exterior:  { color: Colors.accent,   bg: Colors.accentMuted },
  Interior:  { color: Colors.info,     bg: Colors.infoBg      },
  Detail:    { color: Colors.warning,  bg: Colors.warningBg   },
  Detailing: { color: Colors.warning,  bg: Colors.warningBg   },
  Premium:   { color: Colors.warning,  bg: Colors.warningBg   },
  General:   { color: Colors.chromeDark, bg: Colors.surfaceAlt },
  Other:     { color: Colors.chromeDark, bg: Colors.surfaceAlt },
};
const DEFAULT_CAT = { color: Colors.chromeDark, bg: Colors.surfaceAlt };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60
    ? `${m} min`
    : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;

function haptic() {
  if (IS_IOS) Haptics.selectionAsync();
}

function matchesCategory(svc: Service, filter: CategoryFilter): boolean {
  const cat = (svc.category ?? '').toLowerCase();
  switch (filter) {
    case 'All':
    case 'Add-ons': return true;
    case 'Exterior':  return cat === 'exterior';
    case 'Interior':  return cat === 'interior';
    case 'Detailing': return cat.includes('detail');
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
}: {
  width?: number | string;
  height: number;
  radius?: number;
}) {
  return (
    <View
      style={{ width, height, borderRadius: radius, backgroundColor: Colors.surfaceAlt }}
    />
  );
}

function PackageSkeleton() {
  return (
    <View style={[s.pkgCard, { gap: 10 }]}>
      <View style={s.pkgHeaderRow}>
        <SkeletonBlock width="55%" height={20} />
        <SkeletonBlock width={60} height={18} radius={12} />
      </View>
      <SkeletonBlock width="80%" height={13} />
      <SkeletonBlock height={13} />
      <SkeletonBlock width="65%" height={13} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <SkeletonBlock width={56} height={24} radius={6} />
        <SkeletonBlock width={100} height={38} radius={borderRadius.md} />
      </View>
    </View>
  );
}

function ServiceSkeleton() {
  return (
    <View style={[s.svcRow, { gap: 8 }]}>
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBlock width="52%" height={14} />
        <SkeletonBlock width="36%" height={11} />
      </View>
      <SkeletonBlock width={52} height={34} radius={borderRadius.md} />
    </View>
  );
}

function LoadingSkeleton({ showPackages }: { showPackages: boolean }) {
  return (
    <>
      {showPackages && (
        <>
          <Text style={s.sectionLabel}>Packages</Text>
          {[0, 1].map(i => <PackageSkeleton key={i} />)}
          <View style={s.sectionDivider} />
        </>
      )}
      <Text style={s.sectionLabel}>Services</Text>
      {[0, 1, 2, 3].map(i => (
        <View key={i}>
          <ServiceSkeleton />
          {i < 3 && <View style={s.svcSep} />}
        </View>
      ))}
    </>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────

function OfflineBanner({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  const when = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;
  return (
    <View style={s.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={14} color={Colors.warningText} />
      <Text style={s.offlineText}>
        Offline — cached catalog{when ? ` · synced ${when}` : ''}
      </Text>
    </View>
  );
}

// ── Package card ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  index,
  onBook,
}: {
  pkg: Package;
  index: number;
  onBook: () => void;
}) {
  const total    = packagePrice(pkg);
  const duration = packageDuration(pkg);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(280)}>
      <View style={s.pkgCard}>
        {/* Name + duration */}
        <View style={s.pkgHeaderRow}>
          <Text style={s.pkgName} numberOfLines={2}>{pkg.name}</Text>
          <View style={s.pkgDurBadge}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={s.pkgDurText}>{fmtMins(duration)}</Text>
          </View>
        </View>

        {/* Description */}
        {!!pkg.description && (
          <Text style={s.pkgDesc} numberOfLines={2}>{pkg.description}</Text>
        )}

        {/* Included services — checkmark list */}
        {pkg.serviceIds.length > 0 && (
          <View style={s.pkgIncludes}>
            {pkg.serviceIds.map(svc => (
              <View key={svc._id} style={s.pkgIncludeRow}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                <Text style={s.pkgIncludeText}>{svc.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Price + Book button */}
        <View style={s.pkgFooter}>
          <Text style={s.pkgPrice}>{fmt(total)}</Text>
          <Pressable
            style={({ pressed }) => [s.bookBtn, pressed && { opacity: 0.85 }]}
            onPress={onBook}
            android_ripple={{ color: Colors.accentDark + '30', borderless: false }}
          >
            <Text style={s.bookBtnText}>Book This</Text>
            <Ionicons name="arrow-forward" size={13} color={Colors.white} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  index,
  onAdd,
}: {
  service: Service;
  index: number;
  onAdd: () => void;
}) {
  const catColors = CATEGORY_COLORS[service.category ?? ''] ?? DEFAULT_CAT;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
      <View style={s.svcRow}>
        {/* Info */}
        <View style={s.svcInfo}>
          <View style={s.svcNameRow}>
            <Text style={s.svcName} numberOfLines={1}>{service.name}</Text>
            {!!service.category && (
              <View style={[s.catBadge, { backgroundColor: catColors.bg }]}>
                <Text style={[s.catBadgeText, { color: catColors.color }]}>
                  {service.category}
                </Text>
              </View>
            )}
          </View>
          <View style={s.svcMetaRow}>
            {!!service.duration && (
              <>
                <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                <Text style={s.svcMeta}>{fmtMins(service.duration)}</Text>
                <Text style={s.svcMetaDot}>·</Text>
              </>
            )}
            <Text style={s.svcPrice}>{fmt(service.price)}</Text>
          </View>
        </View>

        {/* Add button */}
        <Pressable
          style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.85 }]}
          onPress={onAdd}
          android_ripple={{ color: Colors.accentDark + '30', borderless: false }}
        >
          <Text style={s.addBtnText}>Add</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { services, packages, isOffline, loading, error, lastSyncedAt, refresh } =
    useServiceCatalog();
  const { setServices } = useBooking();

  const [searchText,   setSearchText]   = useState('');
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('All');
  const [refreshing,   setRefreshing]   = useState(false);

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredPackages = useMemo(() => {
    // Packages only visible on "All" tab
    if (activeFilter !== 'All') return [];
    if (!searchText.trim()) return packages;
    const q = searchText.toLowerCase();
    return packages.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.serviceIds.some(s => s.name.toLowerCase().includes(q)),
    );
  }, [packages, activeFilter, searchText]);

  const filteredServices = useMemo(() => {
    let result = services.filter(s => matchesCategory(s, activeFilter));
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [services, activeFilter, searchText]);

  const isEmpty =
    !loading && filteredPackages.length === 0 && filteredServices.length === 0;

  const showSkeleton =
    loading && packages.length === 0 && services.length === 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBookPackage = (pkg: Package) => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setServices(pkg, {}, services);
    router.push('/(customer)/book');
  };

  const handleAddService = (svc: Service) => {
    haptic();
    setServices(null, { [svc._id]: 1 }, services);
    router.push('/(customer)/book');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh(false);
    setRefreshing(false);
  };

  // ── Error (no cached data) ─────────────────────────────────────────────────

  if (!loading && error && packages.length === 0 && services.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader title="Services & Packages" />
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Couldn't load catalog</Text>
          <Text style={s.emptySubtitle}>{error}</Text>
          <Pressable
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => refresh()}
            android_ripple={{ color: Colors.accentDark, borderless: false }}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title="Services & Packages" />

      {isOffline && <OfflineBanner lastSyncedAt={lastSyncedAt} />}

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search services & packages…"
          placeholderTextColor={Colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && Platform.OS !== 'ios' && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Category chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}
        style={s.chipsScroll}
      >
        {CATEGORIES.map(cat => {
          const active = activeFilter === cat;
          return (
            <Pressable
              key={cat}
              style={[s.chip, active && s.chipActive]}
              onPress={() => {
                haptic();
                setActiveFilter(cat);
              }}
              android_ripple={{ color: Colors.accentDark + '20', borderless: false }}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{cat}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Main content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        <Animated.View entering={FadeIn.duration(250)}>
          {showSkeleton ? (
            <LoadingSkeleton showPackages={activeFilter === 'All'} />
          ) : isEmpty ? (
            /* ── Empty state ── */
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="layers-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>
                {searchText ? 'No results found' : 'Nothing here yet'}
              </Text>
              <Text style={s.emptySubtitle}>
                {searchText
                  ? `No services match "${searchText}". Try a different search.`
                  : 'Services and packages will appear here once they're configured.'}
              </Text>
              {!!searchText && (
                <Pressable style={s.clearSearchBtn} onPress={() => setSearchText('')}>
                  <Text style={s.clearSearchText}>Clear search</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {/* ── Packages section ── */}
              {filteredPackages.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>Packages</Text>
                  {filteredPackages.map((pkg, i) => (
                    <React.Fragment key={pkg._id}>
                      <PackageCard
                        pkg={pkg}
                        index={i}
                        onBook={() => handleBookPackage(pkg)}
                      />
                      {i < filteredPackages.length - 1 && <View style={s.pkgSep} />}
                    </React.Fragment>
                  ))}

                  {filteredServices.length > 0 && <View style={s.sectionDivider} />}
                </>
              )}

              {/* ── Services section ── */}
              {filteredServices.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>
                    {activeFilter === 'All' || activeFilter === 'Add-ons'
                      ? 'Individual Services'
                      : `${activeFilter} Services`}
                  </Text>
                  <View style={s.svcCard}>
                    {filteredServices.map((svc, i) => (
                      <React.Fragment key={svc._id}>
                        <ServiceRow
                          service={svc}
                          index={i}
                          onAdd={() => handleAddService(svc)}
                        />
                        {i < filteredServices.length - 1 && <View style={s.svcSep} />}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list:   { paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: SCROLL_PADDING_BOTTOM },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  offlineText: { fontSize: 12, color: Colors.warningText, flex: 1 },

  // Search bar
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },

  // Filter chips
  chipsScroll: { flexGrow: 0 },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText:       { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '700' },

  // Section labels
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },

  // Package cards
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  pkgSep: { height: 12 },
  pkgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  pkgName: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.textPrimary, lineHeight: 24 },
  pkgDurBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pkgDurText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  pkgDesc:    { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },

  pkgIncludes: { gap: 7, marginBottom: 16 },
  pkgIncludeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgIncludeText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  pkgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  pkgPrice: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bookBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // Service list
  svcCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  svcSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 16 },
  svcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  svcInfo:    { flex: 1 },
  svcNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 },
  svcName:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  svcMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  svcMeta:    { fontSize: 12, color: Colors.textMuted },
  svcMetaDot: { fontSize: 12, color: Colors.border, marginHorizontal: 2 },
  svcPrice:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  // Category badge
  catBadge:     { borderRadius: borderRadius.full, paddingHorizontal: 7, paddingVertical: 2 },
  catBadgeText: { fontSize: 10, fontWeight: '700' },

  // Add button
  addBtn: {
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  // Empty state
  emptyWrap:     { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  clearSearchBtn: { marginTop: 16, backgroundColor: Colors.accentMuted, borderRadius: borderRadius.md, paddingHorizontal: 20, paddingVertical: 10 },
  clearSearchText: { fontSize: 14, fontWeight: '600', color: Colors.accent },

  // Error / retry
  retryBtn:     { marginTop: 16, backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
