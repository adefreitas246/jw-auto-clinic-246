// app/(customer)/catalog/index.tsx
// Customer-facing service catalog with offline support.
// Packages are shown first; remaining à-la-carte services as add-ons.
// A sticky footer shows the running price total.
import { Ionicons } from '@expo/vector-icons';
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
import { useBooking } from '@/context/BookingContext';

import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim();

// ─── Offline banner ───────────────────────────────────────────────────────────
function OfflineBanner({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  const when = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'unknown';
  return (
    <View style={s.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={15} color="#7a5200" />
      <Text style={s.offlineText}>
        Offline — showing cached services{lastSyncedAt ? ` (synced ${when})` : ''}
      </Text>
    </View>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────
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
      style={[s.pkgCard, selected && s.pkgCardSelected]}
      onPress={onToggle}
    >
      <View style={s.pkgHeader}>
        <Text style={[s.pkgName, selected && s.pkgNameSelected]}>{pkg.name}</Text>
        <View style={s.pkgPriceBadge}>
          <Text style={s.pkgPrice}>{fmt(total)}</Text>
        </View>
      </View>

      {!!pkg.description && (
        <Text style={s.pkgDesc}>{pkg.description}</Text>
      )}

      <View style={s.pkgServices}>
        {pkg.serviceIds.map(svc => (
          <View key={svc._id} style={s.pkgServicePill}>
            <Text style={s.pkgServiceText}>{svc.name}</Text>
          </View>
        ))}
      </View>

      <View style={s.pkgFooter}>
        <Ionicons name="time-outline" size={13} color="#888" />
        <Text style={s.pkgFooterText}>{fmtMins(duration)}</Text>
        <View style={{ flex: 1 }} />
        {selected && (
          <>
            <Ionicons name="checkmark-circle" size={18} color="#6a0dad" />
            <Text style={s.selectedLabel}>Selected</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

// ─── Add-on row ───────────────────────────────────────────────────────────────
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
        <Text style={s.addonMeta}>
          {fmt(service.price)}  ·  {fmtMins(service.duration)}
        </Text>
      </View>
      <View style={s.qtyControl}>
        <Pressable
          style={[s.qtyBtn, qty === 0 && s.qtyBtnDisabled]}
          onPress={onDecrease}
          disabled={qty === 0}
        >
          <Ionicons name="remove" size={16} color={qty === 0 ? '#ccc' : '#6a0dad'} />
        </Pressable>
        <Text style={s.qtyText}>{qty}</Text>
        <Pressable style={s.qtyBtn} onPress={onIncrease}>
          <Ionicons name="add" size={16} color="#6a0dad" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
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
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  if (error && services.length === 0 && packages.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="cloud-offline-outline" size={48} color="#ccc" />
        <Text style={s.emptyTitle}>No services available</Text>
        <Text style={s.emptySubtitle}>{error}</Text>
        <Pressable style={s.retryBtn} onPress={refresh}>
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
            onPress={() => setTab(key)}
          >
            <Text style={[s.segmentText, tab === key && s.segmentTextActive]}>
              {key === 'packages' ? 'Packages' : 'Add-ons'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {tab === 'packages' ? (
        packages.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptySubtitle}>No packages available.</Text>
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
            renderSectionHeader={() => null}
            contentContainerStyle={s.list}
            onRefresh={refresh}
            refreshing={loading}
          />
        )
      ) : (
        addonSections.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptySubtitle}>No add-on services available.</Text>
          </View>
        ) : (
          <SectionList
            sections={addonSections}
            keyExtractor={s => s._id}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={s.sectionHeader}>{title}</Text>
            )}
            renderItem={({ item }) => (
              <AddOnRow
                service={item}
                qty={addonQty[item._id] ?? 0}
                onIncrease={() => changeQty(item._id, 1)}
                onDecrease={() => changeQty(item._id, -1)}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: hasSelection ? 120 : 32 }]}
            onRefresh={refresh}
            refreshing={loading}
          />
        )
      )}

      {/* Sticky total footer */}
      {hasSelection && (
        <View style={s.footer}>
          <View>
            <Text style={s.footerLabel}>Estimated total</Text>
            <Text style={s.footerDuration}>{fmtMins(totalDuration)}</Text>
          </View>
          <Text style={s.footerTotal}>{fmt(total)}</Text>
          <Pressable
            style={s.bookBtn}
            onPress={() => {
              // Pre-load the selection into BookingContext then start the wizard
              const pkg = selectedPkg ? packages.find(p => p._id === selectedPkg) ?? null : null;
              setServices(pkg, addonQty, services);
              router.push('/(customer)/book');
            }}
          >
            <Text style={s.bookBtnText}>Book Now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7fb' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list:      { padding: 16, paddingBottom: 32 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff8e1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe082',
  },
  offlineText: { fontSize: 12, color: '#7a5200', flex: 1 },

  // Segment control
  segmentWrap: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#e9e0f7',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive:     { backgroundColor: '#fff', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }, android: { elevation: 2 } }) },
  segmentText:       { fontSize: 14, color: '#888', fontWeight: '500' },
  segmentTextActive: { color: '#6a0dad', fontWeight: '700' },

  // Package cards
  pkgCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  pkgCardSelected: { borderColor: '#6a0dad', backgroundColor: '#fdf8ff' },
  pkgHeader:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  pkgName:         { fontSize: 16, fontWeight: '700', color: '#1f1f1f', flex: 1 },
  pkgNameSelected: { color: '#6a0dad' },
  pkgPriceBadge:   { backgroundColor: '#f3eafd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pkgPrice:        { fontSize: 14, fontWeight: '700', color: '#6a0dad' },
  pkgDesc:         { fontSize: 13, color: '#666', marginBottom: 8 },
  pkgServices:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pkgServicePill:  { backgroundColor: '#f0f0f0', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pkgServiceText:  { fontSize: 12, color: '#444' },
  pkgFooter:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pkgFooterText:   { fontSize: 12, color: '#888', marginRight: 4 },
  selectedLabel:   { fontSize: 13, color: '#6a0dad', fontWeight: '600', marginLeft: 2 },

  // Add-on rows
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  addonInfo:   { flex: 1 },
  addonName:   { fontSize: 15, color: '#1f1f1f', fontWeight: '500' },
  addonMeta:   { fontSize: 12, color: '#888', marginTop: 2 },
  qtyControl:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:      { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#6a0dad', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { borderColor: '#ddd' },
  qtyText:     { fontSize: 15, fontWeight: '600', color: '#1f1f1f', minWidth: 20, textAlign: 'center' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  footerLabel:    { fontSize: 11, color: '#888' },
  footerDuration: { fontSize: 12, color: '#6a0dad', marginTop: 1 },
  footerTotal:    { fontSize: 22, fontWeight: '800', color: '#1f1f1f', marginHorizontal: 12 },
  bookBtn:        { backgroundColor: '#6a0dad', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginLeft: 'auto' },
  bookBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Empty / error
  emptyTitle:    { fontSize: 17, fontWeight: '600', color: '#333', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6 },
  retryBtn:      { marginTop: 16, backgroundColor: '#6a0dad', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:  { color: '#fff', fontWeight: '600' },
});
