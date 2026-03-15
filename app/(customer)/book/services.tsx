// app/(customer)/book/services.tsx — Step 2: Package + add-ons (live price total)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator, Platform, Pressable, SectionList,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { useBooking } from '@/context/BookingContext';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtMins = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;

export default function BookServicesStep() {
  const { draft, setServices } = useBooking();
  const { services, packages, loading } = useServiceCatalog();

  const selectedPkgId = draft.selectedPackage?._id ?? null;
  const addonQty      = draft.addonQty;

  const totalPrice    = draft.totalPrice;
  const totalDuration = draft.durationMinutes;

  const handleSelectPkg = (pkg: Package) => {
    const next = selectedPkgId === pkg._id ? null : pkg;
    setServices(next, addonQty, services);
  };

  const handleQty = (id: string, delta: number) => {
    const next = { ...addonQty, [id]: Math.max(0, (addonQty[id] ?? 0) + delta) };
    setServices(draft.selectedPackage, next, services);
  };

  const addonSections = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [services]);

  const canContinue = totalPrice > 0;

  if (loading) return <View style={s.center}><ActivityIndicator color="#6a0dad" size="large" /></View>;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={2} />

      <SectionList
        sections={[
          { title: 'PACKAGES', data: packages as any[], type: 'packages' },
          ...addonSections.map(sec => ({ ...sec, type: 'addons' as const })),
        ]}
        keyExtractor={(item, i) => item._id ?? String(i)}
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          if ((section as any).type === 'packages') {
            const pkg = item as Package;
            const isSelected = selectedPkgId === pkg._id;
            const total = packagePrice(pkg);
            return (
              <Pressable
                style={[s.pkgCard, isSelected && s.pkgCardSelected]}
                onPress={() => handleSelectPkg(pkg)}
              >
                <View style={s.pkgHeader}>
                  <Text style={[s.pkgName, isSelected && { color: '#6a0dad' }]}>{pkg.name}</Text>
                  <Text style={s.pkgPrice}>{fmt(total)}</Text>
                </View>
                {!!pkg.description && <Text style={s.pkgDesc}>{pkg.description}</Text>}
                <View style={s.pkgPills}>
                  {pkg.serviceIds.map(sv => (
                    <View key={sv._id} style={s.pill}><Text style={s.pillText}>{sv.name}</Text></View>
                  ))}
                </View>
                <View style={s.pkgFooter}>
                  <Ionicons name="time-outline" size={12} color="#aaa" />
                  <Text style={s.pkgDur}>{fmtMins(packageDuration(pkg))}</Text>
                  <View style={{ flex: 1 }} />
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color="#6a0dad" />}
                </View>
              </Pressable>
            );
          }
          // add-on row
          const svc = item as Service;
          const qty = addonQty[svc._id] ?? 0;
          return (
            <View style={s.addonRow}>
              <View style={s.addonInfo}>
                <Text style={s.addonName}>{svc.name}</Text>
                <Text style={s.addonMeta}>{fmt(svc.price)}  ·  {fmtMins(svc.duration)}</Text>
              </View>
              <View style={s.qtyCtrl}>
                <Pressable style={[s.qtyBtn, qty === 0 && s.qtyBtnOff]} onPress={() => handleQty(svc._id, -1)} disabled={qty === 0}>
                  <Ionicons name="remove" size={15} color={qty === 0 ? '#ddd' : '#6a0dad'} />
                </Pressable>
                <Text style={s.qtyNum}>{qty}</Text>
                <Pressable style={s.qtyBtn} onPress={() => handleQty(svc._id, 1)}>
                  <Ionicons name="add" size={15} color="#6a0dad" />
                </Pressable>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      />

      {/* Sticky footer */}
      <View style={s.footer}>
        <View style={s.footerInfo}>
          <Text style={s.footerTotal}>{fmt(totalPrice)}</Text>
          {totalDuration > 0 && <Text style={s.footerDur}>{fmtMins(totalDuration)}</Text>}
        </View>
        <Pressable
          style={[s.nextBtn, !canContinue && s.nextBtnOff]}
          onPress={() => router.push('/(customer)/book/datetime')}
          disabled={!canContinue}
        >
          <Text style={s.nextBtnText}>Next — Date & Time</Text>
          <Ionicons name="arrow-forward" size={17} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 6, paddingHorizontal: 4 },

  pkgCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }) },
  pkgCardSelected: { borderColor: '#6a0dad', backgroundColor: '#fdf8ff' },
  pkgHeader:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pkgName:         { flex: 1, fontSize: 15, fontWeight: '700', color: '#1f1f1f' },
  pkgPrice:        { fontSize: 15, fontWeight: '700', color: '#6a0dad' },
  pkgDesc:         { fontSize: 12, color: '#777', marginBottom: 8 },
  pkgPills:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  pill:            { backgroundColor: '#f0f0f0', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  pillText:        { fontSize: 11, color: '#555' },
  pkgFooter:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pkgDur:          { fontSize: 11, color: '#aaa' },

  addonRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 1 } }, android: { elevation: 1 } }) },
  addonInfo: { flex: 1 },
  addonName: { fontSize: 14, fontWeight: '600', color: '#1f1f1f' },
  addonMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  qtyCtrl:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:    { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#6a0dad', alignItems: 'center', justifyContent: 'center' },
  qtyBtnOff: { borderColor: '#ddd' },
  qtyNum:    { fontSize: 14, fontWeight: '600', color: '#1f1f1f', minWidth: 18, textAlign: 'center' },

  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 6 } }) },
  footerInfo:    { flex: 1 },
  footerTotal:   { fontSize: 20, fontWeight: '800', color: '#1f1f1f' },
  footerDur:     { fontSize: 12, color: '#6a0dad', marginTop: 1 },
  nextBtn:       { backgroundColor: '#6a0dad', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextBtnOff:    { opacity: 0.4 },
  nextBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});
