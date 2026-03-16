// app/(customer)/book/services.tsx — Step 2: Package + add-ons (live price total)
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BookingProgressBar } from './_layout';
import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { SkeletonCard } from '@/components/ui';

const fmt     = (n: number) => `$${n.toFixed(2)}`;
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
    Haptics.selectionAsync();
    const next = selectedPkgId === pkg._id ? null : pkg;
    setServices(next, addonQty, services);
  };

  const handleQty = (id: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <BookingProgressBar step={2} />
        <View style={s.loadingContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={s.sectionHeaderWrap}>
            <View style={s.sectionHeaderLine} />
            <Text style={s.sectionHeader}>{section.title}</Text>
            <View style={s.sectionHeaderLine} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        renderItem={({ item, section, index }) => {
          if ((section as any).type === 'packages') {
            const pkg        = item as Package;
            const isSelected = selectedPkgId === pkg._id;
            const total      = packagePrice(pkg);
            const dur        = packageDuration(pkg);
            return (
              <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
                <Pressable
                  style={({ pressed }) => [
                    s.pkgCard,
                    isSelected && s.pkgCardSelected,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => handleSelectPkg(pkg)}
                  android_ripple={{ color: Colors.accent + '20', borderless: false }}
                >
                  {/* Selection indicator bar */}
                  <View style={[s.pkgSelBar, isSelected && s.pkgSelBarActive]} />

                  <View style={s.pkgContent}>
                    {/* Top row: icon + name + price */}
                    <View style={s.pkgTopRow}>
                      <View style={[s.pkgIconCircle, isSelected && s.pkgIconCircleSelected]}>
                        <Ionicons
                          name="layers-outline"
                          size={20}
                          color={isSelected ? Colors.white : Colors.accent}
                        />
                      </View>
                      <View style={s.pkgNameWrap}>
                        <Text style={[s.pkgName, isSelected && s.pkgNameSelected]}>
                          {pkg.name}
                        </Text>
                        {isSelected && (
                          <View style={s.pkgSelectedBadge}>
                            <Ionicons name="checkmark" size={10} color={Colors.white} />
                            <Text style={s.pkgSelectedBadgeText}>Selected</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.pkgPriceWrap}>
                        <Text style={s.pkgPrice}>{fmt(total)}</Text>
                      </View>
                    </View>

                    {/* Description */}
                    {!!pkg.description && (
                      <Text style={s.pkgDesc} numberOfLines={2}>{pkg.description}</Text>
                    )}

                    {/* Service pills */}
                    <View style={s.pkgPills}>
                      {pkg.serviceIds.map(sv => (
                        <View key={sv._id} style={[s.pill, isSelected && s.pillSelected]}>
                          <Text style={[s.pillText, isSelected && s.pillTextSelected]}>
                            {sv.name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Duration row */}
                    <View style={s.pkgFooter}>
                      <View style={s.pkgDurWrap}>
                        <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                        <Text style={s.pkgDur}>{fmtMins(dur)}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                      )}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          }

          // Add-on row
          const svc = item as Service;
          const qty = addonQty[svc._id] ?? 0;
          return (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
              <View style={[s.addonRow, qty > 0 && s.addonRowActive]}>
                <View style={[s.addonIconWrap, qty > 0 && s.addonIconWrapActive]}>
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color={qty > 0 ? Colors.white : Colors.accent}
                  />
                </View>
                <View style={s.addonInfo}>
                  <Text style={s.addonName}>{svc.name}</Text>
                  <View style={s.addonMetaRow}>
                    <Text style={s.addonPrice}>{fmt(svc.price)}</Text>
                    <View style={s.addonDotView} />
                    <Text style={s.addonDur}>{fmtMins(svc.duration)}</Text>
                  </View>
                </View>
                <View style={s.qtyCtrl}>
                  <Pressable
                    style={[s.qtyBtn, qty === 0 && s.qtyBtnOff]}
                    onPress={() => handleQty(svc._id, -1)}
                    disabled={qty === 0}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    <Ionicons name="remove" size={15} color={qty === 0 ? Colors.border : Colors.accent} />
                  </Pressable>
                  <Text style={[s.qtyNum, qty > 0 && s.qtyNumActive]}>{qty}</Text>
                  <Pressable
                    style={s.qtyBtn}
                    onPress={() => handleQty(svc._id, 1)}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    <Ionicons name="add" size={15} color={Colors.accent} />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Sticky footer */}
      <View style={s.footer}>
        <View style={s.footerInfo}>
          <Text style={s.footerLabel}>Total</Text>
          <Text style={s.footerTotal}>{fmt(totalPrice)}</Text>
          {totalDuration > 0 && (
            <View style={s.footerDurWrap}>
              <Ionicons name="time-outline" size={12} color={Colors.accent} />
              <Text style={s.footerDur}>{fmtMins(totalDuration)}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            s.nextBtn,
            !canContinue && s.nextBtnOff,
            pressed && canContinue && { opacity: 0.88 },
          ]}
          onPress={() => router.push('/(customer)/book/datetime')}
          disabled={!canContinue}
          android_ripple={{ color: Colors.accent + '20', borderless: false }}
        >
          <Text style={s.nextBtnText}>Date & Time</Text>
          <Ionicons name="arrow-forward" size={17} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: 16, gap: 12 },
  separator:        { height: 10 },

  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Package card
  pkgCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.transparent,
    flexDirection: 'row',
    ...cardShadow,
  },
  pkgCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  pkgSelBar: {
    width: 5,
    backgroundColor: Colors.transparent,
  },
  pkgSelBarActive: {
    backgroundColor: Colors.accent,
  },
  pkgContent:   { flex: 1, padding: 14 },
  pkgTopRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  pkgIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pkgIconCircleSelected: {
    backgroundColor: Colors.accent,
  },
  pkgNameWrap:   { flex: 1, gap: 4 },
  pkgName:       { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  pkgNameSelected: { color: Colors.accentDark },
  pkgSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pkgSelectedBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  pkgPriceWrap:  { alignItems: 'flex-end' },
  pkgPrice:      { fontSize: 17, fontWeight: '800', color: Colors.accent },
  pkgDesc:       { fontSize: 13, color: Colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  pkgPills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  pill:          { backgroundColor: Colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillSelected:  { backgroundColor: Colors.accent + '20' },
  pillText:      { fontSize: 11, color: Colors.textSecondary },
  pillTextSelected: { color: Colors.accentDark, fontWeight: '600' },
  pkgFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pkgDurWrap:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pkgDur:        { fontSize: 12, color: Colors.textMuted },

  // Add-on row
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...cardShadow,
  },
  addonRowActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  addonIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonIconWrapActive: {
    backgroundColor: Colors.accent,
  },
  addonInfo:    { flex: 1 },
  addonName:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  addonMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addonPrice:   { fontSize: 13, fontWeight: '700', color: Colors.accent },
  addonDotView: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  addonDur:     { fontSize: 12, color: Colors.textMuted },

  // Qty controls
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnOff:    { borderColor: Colors.border },
  qtyNum:       { fontSize: 14, fontWeight: '700', color: Colors.textMuted, minWidth: 20, textAlign: 'center' },
  qtyNumActive: { color: Colors.accent },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: IS_IOS ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...(IS_IOS
      ? { shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 8 }),
  },
  footerInfo:   { flex: 1 },
  footerLabel:  { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotal:  { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  footerDurWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  footerDur:    { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  nextBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextBtnOff:  { opacity: 0.4 },
  nextBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
