// app/(tabs)/inventory/index.tsx — Inventory List with Quick-Adjust Steppers
//
// Features:
//   • Live list with green/yellow/red stock indicators
//   • Category filter chips
//   • Search bar
//   • Quick ±1 / long-press ±10 stepper per card (calls PATCH /:id/adjust)
//   • Pull-to-refresh syncs from API and writes to SQLite cache
//   • Offline fallback: shows cached data with a banner
//   • Admin: FAB + per-card Edit/Delete actions
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, {
  useCallback, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useInventoryCache } from '@/hooks/useInventoryCache';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { ScreenHeader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  _id:               string;
  name:              string;
  category:          string;
  currentStock:      number;
  unit:              string;
  lowStockThreshold: number;
  notes:             string;
  updatedAt:         string;
}

type StockLevel = 'ok' | 'warn' | 'low' | 'out';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stockLevel(item: InventoryItem): StockLevel {
  const { currentStock: s, lowStockThreshold: t } = item;
  if (s <= 0)        return 'out';
  if (s < t)         return 'low';
  if (s < t * 1.75)  return 'warn';
  return 'ok';
}

function stockFillColor(level: StockLevel): string {
  switch (level) {
    case 'ok':   return Colors.success;
    case 'warn': return Colors.warning;
    case 'low':  return Colors.error;
    case 'out':  return Colors.error;
  }
}

function stockBadgeColor(level: StockLevel): { bg: string; text: string; label: string } {
  switch (level) {
    case 'ok':   return { bg: Colors.successBg, text: Colors.successText, label: 'In Stock' };
    case 'warn': return { bg: Colors.warningBg, text: Colors.warningText, label: 'Watch' };
    case 'low':  return { bg: Colors.errorBg,   text: Colors.errorText,   label: 'Low Stock' };
    case 'out':  return { bg: Colors.accentMuted, text: Colors.accent,    label: 'Out' };
  }
}

const ALL_CATEGORIES = [
  'All',
  'Soaps & Chemicals',
  'Wax & Polish',
  'Interior Care',
  'Towels & Cloths',
  'Disposables',
  'Equipment',
  'Other',
];

// ── Low-stock alert flash ──────────────────────────────────────────────────────

function LowStockBanner({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[lb.wrap, { opacity }]}>
      <Ionicons name="warning-outline" size={14} color={Colors.white} />
      <Text style={lb.text}>Low stock alert sent to admin</Text>
    </Animated.View>
  );
}

const lb = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.error, borderRadius: borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: Colors.error, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  text: { fontSize: 12, fontWeight: '700', color: Colors.white },
});

// ── Inventory Card ────────────────────────────────────────────────────────────

function InventoryCard({
  item,
  isAdmin,
  adjusting,
  onAdjust,
  onEdit,
  onDelete,
  index,
}: {
  item:      InventoryItem;
  isAdmin:   boolean;
  adjusting: boolean;
  onAdjust:  (id: string, delta: number) => void;
  onEdit:    (item: InventoryItem) => void;
  onDelete:  (item: InventoryItem) => void;
  index:     number;
}) {
  const level  = stockLevel(item);
  const fill   = stockFillColor(level);
  const badge  = stockBadgeColor(level);
  const pct    = item.lowStockThreshold > 0
    ? Math.min(item.currentStock / (item.lowStockThreshold * 2), 1)
    : 1;

  return (
    <ReAnimated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={ic.card}>
        {/* Header row */}
        <View style={ic.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={ic.name} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={[ic.badge, { backgroundColor: badge.bg }]}>
            <Text style={[ic.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          {isAdmin && (
            <View style={ic.actions}>
              <Pressable
                onPress={() => onEdit(item)}
                hitSlop={8}
                style={ic.iconBtn}
                android_ripple={{ color: Colors.accentMuted, borderless: true, radius: 16 }}
              >
                <Ionicons name="create-outline" size={17} color={Colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={8}
                style={ic.iconBtn}
                android_ripple={{ color: Colors.errorBg, borderless: true, radius: 16 }}
              >
                <Ionicons name="trash-outline" size={17} color={Colors.error} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Category row */}
        <Text style={ic.category}>{item.category}</Text>

        {/* Stock progress bar */}
        <View style={ic.barTrack}>
          <View style={[ic.barFill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: fill }]} />
        </View>
        <Text style={ic.stockLabel}>
          {item.currentStock % 1 === 0 ? item.currentStock : item.currentStock.toFixed(1)} {item.unit} remaining
        </Text>

        {/* +/- stepper */}
        <View style={ic.stepperRow}>
          {/* minus */}
          <Pressable
            style={ic.stepBtn}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAdjust(item._id, -1);
            }}
            onLongPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAdjust(item._id, -10);
            }}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
            disabled={adjusting}
            delayLongPress={500}
          >
            <Text style={ic.stepBtnText}>−</Text>
          </Pressable>

          <View style={ic.stepDisplay}>
            {adjusting
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <Text style={ic.stepValue}>
                  {item.currentStock % 1 === 0 ? item.currentStock : item.currentStock.toFixed(1)}
                </Text>
            }
            <Text style={ic.stepUnit}>{item.unit}</Text>
          </View>

          {/* plus */}
          <Pressable
            style={[ic.stepBtn, ic.stepBtnPlus]}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAdjust(item._id, 1);
            }}
            onLongPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAdjust(item._id, 10);
            }}
            android_ripple={{ color: Colors.accentDark, borderless: false }}
            disabled={adjusting}
            delayLongPress={500}
          >
            <Text style={[ic.stepBtnText, { color: Colors.white }]}>+</Text>
          </Pressable>
        </View>

        {item.notes ? (
          <Text style={ic.notes} numberOfLines={1}>{item.notes}</Text>
        ) : null}
      </View>
    </ReAnimated.View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    ...cardShadow,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  name:      { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  category:  { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  badge:     { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actions:   { flexDirection: 'row', gap: 4 },
  iconBtn:   { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  barTrack:   { height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  barFill:    { height: 6, borderRadius: 3 },
  stockLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },

  stepperRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stepBtn: {
    width: 36, height: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  stepBtnPlus: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: Colors.accent, lineHeight: 22 },
  stepDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 70, justifyContent: 'center' },
  stepValue:   { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  stepUnit:    { fontSize: 11, color: Colors.textMuted },
  notes:       { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const cache    = useInventoryCache();

  const [items,       setItems]       = useState<InventoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isOffline,   setIsOffline]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('All');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [showAlert,   setShowAlert]   = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get<InventoryItem[]>('/api/inventory');
      setItems(data);
      setIsOffline(false);
      await cache.saveAll(data);
    } catch {
      // Offline fallback
      const cached = await cache.readAll();
      if (cached.length > 0) {
        setItems(cached as unknown as InventoryItem[]);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cache]);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItems(true);
  }, [fetchItems]);

  // ── Quick adjust ────────────────────────────────────────────────────────────

  const handleAdjust = useCallback(async (id: string, delta: number) => {
    if (isOffline) return; // Can't adjust while offline
    setAdjustingId(id);
    try {
      const { data } = await axios.patch<InventoryItem & { lowStockAlert?: boolean }>(
        `/api/inventory/${id}/adjust`,
        { delta }
      );
      setItems(prev => prev.map(it => it._id === id ? { ...it, currentStock: data.currentStock } : it));
      await cache.patchStock(id, data.currentStock);
      if (data.lowStockAlert) {
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 3500);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? 'Failed to adjust stock.');
    } finally {
      setAdjustingId(null);
    }
  }, [cache, isOffline]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = useCallback((item: InventoryItem) => {
    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from inventory? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/api/inventory/${item._id}`);
              setItems(prev => prev.filter(it => it._id !== item._id));
              await cache.remove(item._id);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error ?? 'Delete failed.');
            }
          },
        },
      ]
    );
  }, [cache]);

  // ── Navigate to edit ────────────────────────────────────────────────────────

  const openEdit = (item?: InventoryItem) => {
    router.push({
      pathname: '/(tabs)/inventory/edit',
      params:   item ? { id: item._id } : {},
    });
  };

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = items;
    if (category !== 'All') list = list.filter(it => it.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(it =>
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, category, search]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const lowCount = items.filter(it => stockLevel(it) === 'low' || stockLevel(it) === 'out').length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LowStockBanner visible={showAlert} />

      <ScreenHeader
        title="Inventory"
        rightAction={
          isAdmin
            ? {
                label: 'Add',
                icon: 'add-outline',
                onPress: () => openEdit(),
              }
            : undefined
        }
      />

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <View style={s.lowBanner}>
          <Ionicons name="warning" size={16} color={Colors.error} />
          <Text style={s.lowBannerText}>
            {lowCount} item{lowCount !== 1 ? 's' : ''} running low — tap to review
          </Text>
        </View>
      )}

      {/* Offline banner */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.warningText} />
          <Text style={s.offlineText}>Offline — showing cached data</Text>
        </View>
      )}

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginLeft: 12 }} />
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

      {/* Category filter */}
      <FlatList
        data={ALL_CATEGORIES}
        keyExtractor={c => c}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catList}
        renderItem={({ item: cat }) => (
          <Pressable
            style={[s.catChip, category === cat && s.catChipActive]}
            onPress={() => {
              if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCategory(cat);
            }}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text>
          </Pressable>
        )}
        style={{ marginBottom: 4 }}
      />

      {/* Inventory list */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={it => it._id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <ReAnimated.View entering={FadeIn.duration(300)} style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="cube-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>
                {search || category !== 'All' ? 'No items match' : 'No inventory items'}
              </Text>
              <Text style={s.emptyText}>
                {isAdmin
                  ? 'Tap + to add your first item.'
                  : 'Ask an admin to add inventory items.'}
              </Text>
            </ReAnimated.View>
          }
          renderItem={({ item, index }) => (
            <InventoryCard
              item={item}
              isAdmin={isAdmin}
              adjusting={adjustingId === item._id}
              onAdjust={handleAdjust}
              onEdit={openEdit}
              onDelete={handleDelete}
              index={index}
            />
          )}
        />
      )}

      {/* FAB — admin only */}
      {isAdmin && (
        <Pressable
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.88 }]}
          onPress={() => {
            if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            openEdit();
          }}
          android_ripple={{ color: Colors.accentDark, borderless: false }}
        >
          <Ionicons name="add" size={26} color={Colors.white} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Low stock alert banner
  lowBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 0,
  },
  lowBannerText: { fontSize: 13, fontWeight: '600', color: Colors.errorText, flex: 1 },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warningBg, marginHorizontal: SCREEN_PADDING, borderRadius: borderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  offlineText: { fontSize: 12, color: Colors.warningText, fontWeight: '600' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    marginHorizontal: SCREEN_PADDING, marginBottom: 8,
    marginTop: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 12,
    fontSize: 14, color: Colors.textPrimary,
  },

  // Category chips
  catList: { paddingHorizontal: SCREEN_PADDING, gap: 8, paddingBottom: 100 },
  catChip: {
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  catChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  catText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  catTextActive: { color: Colors.accent },

  // List
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SCROLL_PADDING_BOTTOM },
  separator:   { height: 8 },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: borderRadius.full,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },

  // Empty
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyText:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
