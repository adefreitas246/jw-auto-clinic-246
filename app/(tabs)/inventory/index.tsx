// app/(tabs)/inventory/index.tsx — Inventory List
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  lowStockThreshold: number;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Soap', 'Wax', 'Cloths', 'Equipment', 'Other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockPct(item: InventoryItem): number {
  if (item.lowStockThreshold <= 0) return 1;
  return Math.min(item.currentStock / (item.lowStockThreshold * 2), 1);
}

function stockBarColor(item: InventoryItem): string {
  const pct = stockPct(item);
  if (pct > 0.5) return Colors.success;  // above 50% → green
  if (pct > 0.2) return Colors.warning;  // 20–50% → yellow
  return Colors.error;                   // below 20% → red
}

function isLowStock(item: InventoryItem): boolean {
  return item.currentStock <= item.lowStockThreshold;
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ─── InventoryCard ────────────────────────────────────────────────────────────

function InventoryCard({
  item,
  adjustingId,
  onAdjust,
}: {
  item: InventoryItem;
  adjustingId: string | null;
  onAdjust: (id: string, delta: number) => void;
}) {
  const barColor    = stockBarColor(item);
  const pct         = stockPct(item);
  const low         = isLowStock(item);
  const isAdjusting = adjustingId === item._id;

  return (
    <Pressable
      style={ic.card}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/inventory/edit' as any,
          params:   { id: item._id },
        })
      }
      android_ripple={{ color: Colors.accent + '10', borderless: false }}
    >
      {/* Name + badge row */}
      <View style={ic.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={ic.name} numberOfLines={1}>{item.name}</Text>
          <Text style={ic.category}>{item.category}</Text>
        </View>
        {low && (
          <View style={ic.lowBadge}>
            <Text style={ic.lowBadgeText}>Low Stock</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={ic.barTrack}>
        <View
          style={[
            ic.barFill,
            {
              width:           `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` as any,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      {/* Stock label */}
      <Text style={ic.stockLabel}>
        {fmtQty(item.currentStock)} {item.unit} remaining
      </Text>

      {/* Quick-adjust stepper */}
      <View style={ic.stepRow}>
        {/* − button */}
        <Pressable
          style={ic.stepBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdjust(item._id, -1);
          }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAdjust(item._id, -10);
          }}
          disabled={isAdjusting}
          hitSlop={8}
          delayLongPress={500}
        >
          <Text style={ic.minusText}>−</Text>
        </Pressable>

        {/* Quantity display */}
        <View style={ic.stepDisplay}>
          {isAdjusting ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Text style={ic.stepValue}>{fmtQty(item.currentStock)}</Text>
          )}
          <Text style={ic.stepUnit}>{item.unit}</Text>
        </View>

        {/* + button */}
        <Pressable
          style={[ic.stepBtn, ic.plusBtn]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdjust(item._id, 1);
          }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAdjust(item._id, 10);
          }}
          disabled={isAdjusting}
          hitSlop={8}
          delayLongPress={500}
        >
          <Text style={ic.plusText}>+</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius:    borderRadius.xl,
    padding:         16,
    borderWidth:     1,
    borderColor:     Colors.border,
    ...cardShadow,
  },
  topRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  name:     { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  category: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  lowBadge: {
    backgroundColor: Colors.errorBg,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  lowBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.errorText },

  barTrack: {
    height: 6, backgroundColor: Colors.surfaceAlt,
    borderRadius: 3, overflow: 'hidden', marginBottom: 6,
  },
  barFill:     { height: 6, borderRadius: 3 },
  stockLabel:  { fontSize: 12, color: Colors.textSecondary, marginBottom: 14 },

  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 44, height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  minusText: { fontSize: 22, fontWeight: '700', color: Colors.textSecondary, lineHeight: 26 },
  plusBtn:   { backgroundColor: Colors.accent, borderColor: Colors.accent },
  plusText:  { fontSize: 22, fontWeight: '700', color: Colors.white, lineHeight: 26 },
  stepDisplay: {
    flex: 1, flexDirection: 'row',
    alignItems: 'baseline', gap: 4, justifyContent: 'center',
  },
  stepValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  stepUnit:  { fontSize: 12, color: Colors.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const [items,       setItems]       = useState<InventoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('All');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const { data } = await axios.get<InventoryItem[]>('/api/inventory');
      setItems(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  // ── Quick adjust ──────────────────────────────────────────────────────────
  const handleAdjust = useCallback(async (id: string, delta: number) => {
    // Optimistic update
    setItems(prev =>
      prev.map(it =>
        it._id === id
          ? { ...it, currentStock: Math.max(0, it.currentStock + delta) }
          : it,
      ),
    );
    setAdjustingId(id);
    try {
      const { data } = await axios.patch<InventoryItem>(`/api/inventory/${id}`, { delta });
      setItems(prev =>
        prev.map(it => it._id === id ? { ...it, currentStock: data.currentStock } : it),
      );
    } catch (e: any) {
      fetchItems(); // revert
      Alert.alert('Error', e.response?.data?.error ?? 'Failed to update stock.');
    } finally {
      setAdjustingId(null);
    }
  }, [fetchItems]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const lowCount = items.filter(isLowStock).length;

  const filtered = useMemo(() => {
    let list = showLowOnly ? items.filter(isLowStock) : items;
    if (category !== 'All') {
      list = list.filter(it =>
        it.category.toLowerCase().includes(category.toLowerCase()),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(it =>
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, category, search, showLowOnly]);

  const openAdd = () => router.push('/(tabs)/inventory/edit' as any);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Inventory</Text>
        <Pressable style={s.addBtn} onPress={openAdd} hitSlop={8}>
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={s.addBtnText}>Add Item</Text>
        </Pressable>
      </View>

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <Pressable
          style={[s.lowBanner, showLowOnly && s.lowBannerOn]}
          onPress={() => setShowLowOnly(v => !v)}
        >
          <Ionicons
            name="warning"
            size={16}
            color={showLowOnly ? Colors.white : Colors.error}
          />
          <Text style={[s.lowBannerText, showLowOnly && { color: Colors.white }]}>
            {showLowOnly
              ? `Showing ${lowCount} low-stock item${lowCount !== 1 ? 's' : ''} — tap to show all`
              : `⚠ ${lowCount} item${lowCount !== 1 ? 's' : ''} running low — tap to view`}
          </Text>
          <Ionicons
            name={showLowOnly ? 'close-circle' : 'chevron-forward'}
            size={14}
            color={showLowOnly ? Colors.white : Colors.errorText}
          />
        </Pressable>
      )}

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        style={{ flexGrow: 0, marginBottom: 8 }}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[s.chip, category === cat && s.chipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCategory(cat);
            }}
          >
            <Text style={[s.chipText, category === cat && s.chipTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Inventory list */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={it => it._id}
          contentContainerStyle={[s.list, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchItems(); }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="cube-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>
                {search || category !== 'All' || showLowOnly
                  ? 'No items match'
                  : 'No inventory items'}
              </Text>
              <Text style={s.emptyText}>Tap + to add your first item.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              adjustingId={adjustingId}
              onAdjust={handleAdjust}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable style={s.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, borderRadius: borderRadius.md,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // Low stock banner
  lowBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  lowBannerOn:   { backgroundColor: Colors.error, borderLeftColor: Colors.errorText },
  lowBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.errorText },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    marginHorizontal: SCREEN_PADDING, marginTop: 10, marginBottom: 6,
    paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, paddingVertical: 12,
    fontSize: 14, color: Colors.textPrimary,
  },

  // Category chips
  chips:         { paddingHorizontal: SCREEN_PADDING, gap: 8 },
  chip: {
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.white, overflow: 'hidden',
  },
  chipActive:     { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  chipText:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.accent },

  // List
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: 4 },

  // FAB
  fab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: SCREEN_PADDING },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: Colors.textMuted },
});
