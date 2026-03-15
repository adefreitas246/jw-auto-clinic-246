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
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useInventoryCache } from '@/hooks/useInventoryCache';
import { Colors } from '@/constants/Colors';

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

const LEVEL_CONFIG: Record<StockLevel, { border: string; badge: string; text: string; label: string }> = {
  ok:   { border: Colors.success, badge: '#d1fae5', text: Colors.success, label: 'In Stock'  },
  warn: { border: Colors.warning, badge: Colors.warningBg, text: Colors.warning, label: 'Watch'     },
  low:  { border: Colors.error, badge: Colors.errorBg, text: Colors.error, label: 'Low Stock' },
  out:  { border: '#7c3aed', badge: '#ede9fe', text: '#7c3aed', label: 'Out'       },
};

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

// ── Stock bar ─────────────────────────────────────────────────────────────────

function StockBar({ item }: { item: InventoryItem }) {
  const level  = stockLevel(item);
  const cfg    = LEVEL_CONFIG[level];
  // Bar fills to 100% when stock = threshold × 2; capped at 100%
  const pct    = item.lowStockThreshold > 0
    ? Math.min(item.currentStock / (item.lowStockThreshold * 2), 1)
    : 1;

  return (
    <View style={sb.wrap}>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: cfg.border }]} />
      </View>
      <Text style={[sb.threshold, { color: Colors.textMuted }]}>
        threshold {item.lowStockThreshold} {item.unit}
      </Text>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap:      { marginTop: 6, marginBottom: 4 },
  track:     { height: 5, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  fill:      { height: 5, borderRadius: 3 },
  threshold: { fontSize: 9, marginTop: 3 },
});

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({
  value, unit, loading, onDelta,
}: {
  value: number; unit: string; loading: boolean; onDelta: (delta: number) => void;
}) {
  return (
    <View style={stp.row}>
      <Pressable
        style={({ pressed }) => [stp.btn, pressed && stp.pressed]}
        onPress={() => onDelta(-1)}
        onLongPress={() => onDelta(-10)}
        disabled={loading}
        delayLongPress={500}
      >
        <Text style={stp.btnText}>−</Text>
      </Pressable>

      <View style={stp.display}>
        {loading
          ? <ActivityIndicator size="small" color={Colors.accent} />
          : <Text style={stp.value}>{value % 1 === 0 ? value : value.toFixed(1)}</Text>
        }
        <Text style={stp.unit}>{unit}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [stp.btn, stp.btnPlus, pressed && stp.pressed]}
        onPress={() => onDelta(1)}
        onLongPress={() => onDelta(10)}
        disabled={loading}
        delayLongPress={500}
      >
        <Text style={[stp.btnText, { color: Colors.white }]}>+</Text>
      </Pressable>
    </View>
  );
}

const stp = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn:     {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  btnPlus: { backgroundColor: Colors.accent },
  pressed: { opacity: 0.65 },
  btnText: { fontSize: 18, fontWeight: '700', color: Colors.accent, lineHeight: 22 },
  display: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    minWidth: 80, justifyContent: 'center',
  },
  value: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  unit:  { fontSize: 11, color: Colors.textMuted },
});

// ── Inventory Card ────────────────────────────────────────────────────────────

function InventoryCard({
  item,
  isAdmin,
  adjusting,
  onAdjust,
  onEdit,
  onDelete,
}: {
  item:      InventoryItem;
  isAdmin:   boolean;
  adjusting: boolean;
  onAdjust:  (id: string, delta: number) => void;
  onEdit:    (item: InventoryItem) => void;
  onDelete:  (item: InventoryItem) => void;
}) {
  const level = stockLevel(item);
  const cfg   = LEVEL_CONFIG[level];

  return (
    <View style={[ic.card, { borderLeftColor: cfg.border }]}>
      {/* Header row */}
      <View style={ic.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={ic.name} numberOfLines={1}>{item.name}</Text>
          <Text style={ic.category}>{item.category}</Text>
        </View>
        <View style={[ic.badge, { backgroundColor: cfg.badge }]}>
          <Text style={[ic.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
        {isAdmin && (
          <View style={ic.actions}>
            <Pressable onPress={() => onEdit(item)} hitSlop={8} style={ic.iconBtn}>
              <Ionicons name="create-outline" size={17} color={Colors.accent} />
            </Pressable>
            <Pressable onPress={() => onDelete(item)} hitSlop={8} style={ic.iconBtn}>
              <Ionicons name="trash-outline" size={17} color={Colors.error} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Stock bar */}
      <StockBar item={item} />

      {/* Stepper */}
      <View style={ic.footer}>
        <Stepper
          value={item.currentStock}
          unit={item.unit}
          loading={adjusting}
          onDelta={delta => onAdjust(item._id, delta)}
        />
        {item.notes ? (
          <Text style={ic.notes} numberOfLines={1}>{item.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name:      { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  category:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  badge:     { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actions:   { flexDirection: 'row', gap: 4 },
  iconBtn:   { padding: 4 },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  notes:     { fontSize: 11, color: Colors.textMuted, flex: 1, marginLeft: 12, textAlign: 'right' },
});

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
    backgroundColor: Colors.error, borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 7,
    zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: Colors.error, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  text: { fontSize: 12, fontWeight: '700', color: Colors.white },
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

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Inventory</Text>
          <Text style={s.sub}>
            {items.length} items
            {lowCount > 0 && ` · `}
            {lowCount > 0 && <Text style={{ color: Colors.error }}>{lowCount} low</Text>}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAdmin && (
            <Pressable
              style={s.headerBtn}
              onPress={() => router.push('/(tabs)/inventory/service-map')}
              hitSlop={8}
            >
              <Ionicons name="git-branch-outline" size={16} color={Colors.accent} />
              <Text style={s.headerBtnText}>Mappings</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#92400e" />
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
            onPress={() => setCategory(cat)}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={52} color={Colors.border} />
              <Text style={s.emptyTitle}>
                {search || category !== 'All' ? 'No items match' : 'No inventory items'}
              </Text>
              <Text style={s.emptyText}>
                {isAdmin
                  ? 'Tap + to add your first item.'
                  : 'Ask an admin to add inventory items.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              isAdmin={isAdmin}
              adjusting={adjustingId === item._id}
              onAdjust={handleAdjust}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {/* FAB — admin only */}
      {isAdmin && (
        <Pressable
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
          onPress={() => openEdit()}
        >
          <Ionicons name="add" size={26} color={Colors.white} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
}) ?? {};

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  title:       { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  sub:         { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f3eafd', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
  },
  headerBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warningBg, marginHorizontal: 16, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8,
  },
  offlineText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 12, marginHorizontal: 16, marginBottom: 8,
    ...SHADOW,
  },
  searchInput: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },

  // Category chips
  catList: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  catChip: {
    borderRadius: 99, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.white,
  },
  catChipActive: { borderColor: Colors.accent, backgroundColor: '#f3eafd' },
  catText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  catTextActive: { color: Colors.accent },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
