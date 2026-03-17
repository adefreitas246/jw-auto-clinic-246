// app/(customer)/catalog/index.tsx
// Customer-facing service catalog with offline support.
// Packages are shown first; remaining à-la-carte services as add-ons.
// A sticky footer shows the running price total.
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { useBooking } from '@/context/BookingContext';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { IS_IOS } from '@/utils/platform';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim();

// ─── Offline banner ────────────────────────────────────────────────────────────
function OfflineBanner({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  const when = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'unknown';
  return (
    <View style={s.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={15} color={Colors.warningText} />
      <Text style={s.offlineText}>
        Offline — showing cached services{lastSyncedAt ? ` (synced ${when})` : ''}
      </Text>
    </View>
  );
}

// ─── Package card ──────────────────────────────────────────────────────────────
function PackageCard({
  pkg,
  selected,
  onToggle,
}: {
  pkg: Package;
  selected: boolean;
  onToggle: () => void;
}) {
  const total    = packagePrice(pkg);
  const duration = packageDuration(pkg);

  return (
    <Pressable
      style={({ pressed }) => [
        s.pkgCard,
        selected && s.pkgCardSelected,
        pressed && { opacity: 0.88 },
      ]}
      onPress={() => {
        if (IS_IOS) Haptics.selectionAsync();
        onToggle();
      }}
      android_ripple={{ color: Colors.accentMuted, borderless: false }}
    >
      <View style={s.pkgHeader}>
        <Text style={[s.pkgName, selected && s.pkgNameSelected]}>{pkg.name}</Text>
        <View style={[s.pkgPriceBadge, selected && s.pkgPriceBadgeSelected]}>
          <Text style={[s.pkgPrice, selected && s.pkgPriceSelected]}>{fmt(total)}</Text>
        </View>
      </View>

      {!!pkg.description && (
        <Text style={s.pkgDesc}>{pkg.description}</Text>
      )}

      <View style={s.pkgServices}>
        {pkg.serviceIds.map(svc => (
          <View key={svc._id} style={[s.pkgServicePill, selected && s.pkgServicePillSelected]}>
            <Text style={[s.pkgServiceText, selected && s.pkgServiceTextSelected]}>{svc.name}</Text>
          </View>
        ))}
      </View>

      <View style={s.pkgFooter}>
        <View style={s.pkgDurationBadge}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={s.pkgFooterText}>{fmtMins(duration)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {selected ? (
          <View style={s.selectedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
            <Text style={s.selectedLabel}>Selected</Text>
          </View>
        ) : (
          <Text style={s.tapToSelect}>Tap to select</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Add-on row ────────────────────────────────────────────────────────────────
function AddOnRow({
  service,
  qty,
  onIncrease,
  onDecrease,
}: {
  service: Service;
  qty: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <View style={s.addonRow}>
      <View style={s.addonInfo}>
        <Text style={s.addonName}>{service.name}</Text>
        <View style={s.addonMetaRow}>
          <View style={s.addonMetaBadge}>
            <Text style={s.addonMetaText}>{fmt(service.price)}</Text>
          </View>
          <View style={s.addonMetaBadge}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={s.addonMetaText}>{fmtMins(service.duration)}</Text>
          </View>
        </View>
      </View>
      <View style={s.qtyControl}>
        <Pressable
          style={[s.qtyBtn, qty === 0 && s.qtyBtnDisabled]}
          onPress={() => {
            if (IS_IOS && qty > 0) Haptics.selectionAsync();
            onDecrease();
          }}
          disabled={qty === 0}
          android_ripple={{ color: Colors.accentMuted, borderless: true }}
          hitSlop={8}
        >
          <Ionicons name="remove" size={16} color={qty === 0 ? Colors.border : Colors.accent} />
        </Pressable>
        <Text style={s.qtyText}>{qty}</Text>
        <Pressable
          style={s.qtyBtn}
          onPress={() => {
            if (IS_IOS) Haptics.selectionAsync();
            onIncrease();
          }}
          android_ripple={{ color: Colors.accentMuted, borderless: true }}
          hitSlop={8}
        >
          <Ionicons name="add" size={16} color={Colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
type TabKey = 'packages' | 'addons';

export default function CatalogScreen() {
  const { services, packages, isOffline, loading, error, lastSyncedAt, refresh } =
    useServiceCatalog();
  const { setServices } = useBooking();

  const [tab, setTab]                 = useState<TabKey>('packages');
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [addonQty, setAddonQty]       = useState<Record<string, number>>({});

  // Services already covered by the selected package (greyed out as add-ons)
  const coveredIds = useMemo(() => {
    if (!selectedPkg) return new Set<string>();
    const pkg = packages.find(p => p._id === selectedPkg);
    return new Set(pkg?.serviceIds.map(s => s._id) ?? []);
  }, [selectedPkg, packages]);

  // Compute running total
  const total = useMemo(() => {
    let sum = 0;
    if (selectedPkg) {
      const pkg = packages.find(p => p._id === selectedPkg);
      if (pkg) sum += packagePrice(pkg);
    }
    for (const [id, qty] of Object.entries(addonQty)) {
      if (qty > 0) {
        const svc = services.find(s => s._id === id);
        if (svc) sum += svc.price * qty;
      }
    }
    return sum;
  }, [selectedPkg, addonQty, packages, services]);

  const totalDuration = useMemo(() => {
    let mins = 0;
    if (selectedPkg) {
      const pkg = packages.find(p => p._id === selectedPkg);
      if (pkg) mins += packageDuration(pkg);
    }
    for (const [id, qty] of Object.entries(addonQty)) {
      if (qty > 0) {
        const svc = services.find(s => s._id === id);
        if (svc) mins += svc.duration * qty;
      }
    }
    return mins;
  }, [selectedPkg, addonQty, packages, services]);

  const changeQty = (id: string, delta: number) => {
    setAddonQty(prev => {
      const next = (prev[id] ?? 0) + delta;
      return { ...prev, [id]: Math.max(0, next) };
    });
  };

  // Group add-on services by category for SectionList
  const addonSections = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const svc of services) {
      if (!map.has(svc.category)) map.set(svc.category, []);
      map.get(svc.category)!.push(svc);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [services]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={s.loadingText}>Loading catalog…</Text>
      </View>
    );
  }

  if (error && services.length === 0 && packages.length === 0) {
    return (
      <View style={s.center}>
        <View style={s.emptyIconWrap}>
          <Ionicons name="cloud-offline-outline" size={32} color={Colors.textMuted} />
        </View>
        <Text style={s.emptyTitle}>No services available</Text>
        <Text style={s.emptySubtitle}>{error}</Text>
        <Pressable
          style={s.retryBtn}
          onPress={refresh}
          android_ripple={{ color: Colors.accentDark, borderless: false }}
        >
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const hasSelection = selectedPkg !== null || Object.values(addonQty).some(q => q > 0);

  return (
    <View style={s.container}>
      {isOffline && <OfflineBanner lastSyncedAt={lastSyncedAt} />}

      {/* Segment tabs */}
      <View style={s.segmentWrap}>
        {(['packages', 'addons'] as TabKey[]).map(key => (
          <Pressable
            key={key}
            style={[s.segment, tab === key && s.segmentActive]}
            onPress={() => {
              if (IS_IOS) Haptics.selectionAsync();
              setTab(key);
            }}
            android_ripple={{ color: Colors.accentMuted, borderless: false }}
          >
            <Text style={[s.segmentText, tab === key && s.segmentTextActive]}>
              {key === 'packages' ? 'Packages' : 'Add-ons'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
        {tab === 'packages' ? (
          packages.length === 0 ? (
            <View style={s.center}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="layers-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No packages available</Text>
              <Text style={s.emptySubtitle}>Check back soon for new packages.</Text>
            </View>
          ) : (
            <SectionList
              sections={[{ title: '', data: packages }]}
              keyExtractor={p => p._id}
              renderItem={({ item }) => (
                <PackageCard
                  pkg={item}
                  selected={selectedPkg === item._id}
                  onToggle={() =>
                    setSelectedPkg(prev => (prev === item._id ? null : item._id))
                  }
                />
              )}
              ItemSeparatorComponent={() => <View style={s.separator} />}
              renderSectionHeader={() => null}
              contentContainerStyle={[s.list, { paddingBottom: hasSelection ? 120 : SCROLL_PADDING_BOTTOM }]}
              onRefresh={refresh}
              refreshing={loading}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          addonSections.length === 0 ? (
            <View style={s.center}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="add-circle-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No add-ons available</Text>
              <Text style={s.emptySubtitle}>Add-on services will appear here.</Text>
            </View>
          ) : (
            <SectionList
              sections={addonSections}
              keyExtractor={s => s._id}
              renderSectionHeader={({ section: { title } }) => (
                <View style={s.sectionHeaderWrap}>
                  <Text style={s.sectionHeader}>{title}</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <AddOnRow
                  service={item}
                  qty={addonQty[item._id] ?? 0}
                  onIncrease={() => changeQty(item._id, 1)}
                  onDecrease={() => changeQty(item._id, -1)}
                />
              )}
              ItemSeparatorComponent={() => <View style={s.separator} />}
              contentContainerStyle={[s.list, { paddingBottom: hasSelection ? 120 : SCROLL_PADDING_BOTTOM }]}
              onRefresh={refresh}
              refreshing={loading}
              showsVerticalScrollIndicator={false}
            />
          )
        )}
      </Animated.View>

      {/* Sticky total footer */}
      {hasSelection && (
        <View style={s.footer}>
          <View style={s.footerInfo}>
            <Text style={s.footerLabel}>Estimated total</Text>
            <View style={s.footerDurationRow}>
              <Ionicons name="time-outline" size={12} color={Colors.accent} />
              <Text style={s.footerDuration}>{fmtMins(totalDuration)}</Text>
            </View>
          </View>
          <Text style={s.footerTotal}>{fmt(total)}</Text>
          <Pressable
            style={({ pressed }) => [s.bookBtn, pressed && { opacity: 0.88 }]}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              // Pre-load the selection into BookingContext then start the wizard
              const pkg = selectedPkg ? packages.find(p => p._id === selectedPkg) ?? null : null;
              setServices(pkg, addonQty, services);
              router.push('/(customer)/book');
            }}
            android_ripple={{ color: Colors.accentDark, borderless: false }}
          >
            <Text style={s.bookBtnText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list:      { paddingHorizontal: SCREEN_PADDING, paddingTop: 12 },

  loadingText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  offlineText: { fontSize: 12, color: Colors.warningText, flex: 1 },

  // Segment control
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: SCREEN_PADDING,
    marginVertical: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.white,
    ...cardShadow,
  },
  segmentText:       { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  segmentTextActive: { color: Colors.accent, fontWeight: '700' },

  // Separator
  separator: { height: 8 },

  // Package cards
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...cardShadow,
  },
  pkgCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  pkgHeader:             { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pkgName:               { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  pkgNameSelected:       { color: Colors.accent },
  pkgPriceBadge:         { backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  pkgPriceBadgeSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pkgPrice:              { fontSize: 14, fontWeight: '700', color: Colors.accent },
  pkgPriceSelected:      { color: Colors.white },
  pkgDesc:               { fontSize: 13, color: Colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  pkgServices:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pkgServicePill:        { backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  pkgServicePillSelected: { backgroundColor: 'rgba(14,165,233,0.15)', borderColor: Colors.accentLight },
  pkgServiceText:        { fontSize: 12, color: Colors.textSecondary },
  pkgServiceTextSelected: { color: Colors.accentDark },
  pkgFooter:             { flexDirection: 'row', alignItems: 'center' },
  pkgDurationBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  pkgFooterText:         { fontSize: 12, color: Colors.textMuted },
  selectedBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  selectedLabel:         { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  tapToSelect:           { fontSize: 12, color: Colors.textMuted },

  // Add-on rows
  sectionHeaderWrap: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  addonInfo:     { flex: 1 },
  addonName:     { fontSize: 15, color: Colors.textPrimary, fontWeight: '600', marginBottom: 6 },
  addonMetaRow:  { flexDirection: 'row', gap: 6 },
  addonMetaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  addonMetaText: { fontSize: 11, color: Colors.textMuted },
  qtyControl:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { borderColor: Colors.border },
  qtyText:       { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios:     { shadowColor: Colors.shadow, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
    paddingBottom: IS_IOS ? 28 : 12,
    gap: 12,
  },
  footerInfo:        { flex: 1 },
  footerLabel:       { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  footerDurationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  footerDuration:    { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  footerTotal:       { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  bookBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 20, paddingVertical: 12 },
  bookBtnText:       { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Empty / error
  emptyIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle:     { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  emptySubtitle:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryBtn:       { marginTop: 16, backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 28, paddingVertical: 12 },
  retryBtnText:   { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
