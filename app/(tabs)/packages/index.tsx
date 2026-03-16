// app/(tabs)/packages/index.tsx — admin package list
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';

import { Package, packagePrice } from '@/types/catalog';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ─── Swipe actions ────────────────────────────────────────────────────────────

function RightActions({
  progress,
  onEdit,
  onDelete,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const x = progress.interpolate({ inputRange: [0, 1], outputRange: [136, 0] });
  return (
    <Animated.View style={[a.actions, { transform: [{ translateX: x }] }]}>
      <Pressable
        style={[a.btn, a.editBtn]}
        onPress={onEdit}
        android_ripple={{ color: Colors.accent + '12', borderless: false }}
      >
        <Ionicons name="create-outline" size={18} color={Colors.white} />
        <Text style={a.btnText}>Edit</Text>
      </Pressable>
      <Pressable
        style={[a.btn, a.deleteBtn]}
        onPress={onDelete}
        android_ripple={{ color: Colors.accent + '12', borderless: false }}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.white} />
        <Text style={a.btnText}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageRow({
  pkg,
  onToggle,
  onEdit,
  onDelete,
}: {
  pkg: Package;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={prog => (
        <RightActions
          progress={prog}
          onEdit={() => { swipeRef.current?.close(); onEdit(); }}
          onDelete={() => {
            swipeRef.current?.close();
            Alert.alert('Delete Package', `Remove "${pkg.name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ]);
          }}
        />
      )}
      overshootRight={false}
    >
      <View style={[s.card, !pkg.active && s.cardInactive]}>
        {/* Top: name + price + toggle */}
        <View style={s.cardTop}>
          <View style={s.cardHeader}>
            {/* Price badge */}
            <View style={s.priceBadge}>
              <Text style={s.priceText}>${packagePrice(pkg).toFixed(2)}</Text>
              <Text style={s.priceMode}>{pkg.price == null ? 'auto' : 'fixed'}</Text>
            </View>
            <Switch
              value={pkg.active}
              onValueChange={onToggle}
              trackColor={{ true: Colors.accent, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>

          <Text style={[s.name, !pkg.active && s.textMuted]} numberOfLines={1}>
            {pkg.name}
          </Text>

          {!!pkg.description && (
            <Text style={s.description} numberOfLines={2}>{pkg.description}</Text>
          )}
        </View>

        {/* Services list */}
        <View style={s.servicesWrap}>
          <View style={s.servicesHeader}>
            <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
            <Text style={s.servicesLabel}>
              {pkg.serviceIds.length} included service{pkg.serviceIds.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {pkg.serviceIds.slice(0, 3).map((svc, i) => (
            <View key={i} style={s.svcChip}>
              <View style={s.svcDot} />
              <Text style={s.svcName} numberOfLines={1}>
                {typeof svc === 'string' ? svc : (svc as any).name ?? svc}
              </Text>
            </View>
          ))}
          {pkg.serviceIds.length > 3 && (
            <Text style={s.moreText}>+{pkg.serviceIds.length - 3} more</Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManagePackagesScreen() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<Package[]>('/api/packages');
      setPackages(res.data);
    } catch {
      Alert.alert('Error', 'Could not load packages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (pkg: Package, active: boolean) => {
    try {
      const res = await axios.put<Package>(`/api/packages/${pkg._id}`, { active });
      setPackages(prev => prev.map(p => (p._id === pkg._id ? res.data : p)));
    } catch {
      Alert.alert('Error', 'Could not update package.');
    }
  };

  const deletePackage = async (id: string) => {
    try {
      await axios.delete(`/api/packages/${id}`);
      setPackages(prev => prev.filter(p => p._id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete package.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        {packages.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyIcon}>
              <Ionicons name="albums-outline" size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No packages yet</Text>
            <Text style={s.emptyText}>Tap the + button to create your first package.</Text>
          </View>
        ) : (
          <Animated.FlatList
            data={packages}
            keyExtractor={p => p._id}
            renderItem={({ item }) => (
              <PackageRow
                pkg={item}
                onToggle={active => toggleActive(item, active)}
                onEdit={() => router.push(`/(tabs)/packages/${item._id}`)}
                onDelete={() => deletePackage(item._id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={s.sep} />}
            contentContainerStyle={s.list}
            onRefresh={load}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* FAB */}
        <Pressable
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(tabs)/packages/add')}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.surfaceAlt },
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  sep:       { height: 8 },

  // Empty state
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...cardShadow },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardInactive: { opacity: 0.5 },
  cardTop:      { padding: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  // Price badge
  priceBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceText:  { fontSize: 20, fontWeight: '800', color: Colors.accent },
  priceMode:  { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },

  name:        { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  textMuted:   { color: Colors.textMuted },
  description: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Services list section
  servicesWrap:   { backgroundColor: Colors.surfaceAlt, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  servicesHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  servicesLabel:  { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  svcChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  svcDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  svcName:        { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  moreText:       { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_IOS
      ? { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 6 }),
  },
});

const a = StyleSheet.create({
  actions:   { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  btn:       { width: 62, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, marginLeft: 4 },
  editBtn:   { backgroundColor: Colors.accent },
  deleteBtn: { backgroundColor: Colors.error },
  btnText:   { color: Colors.white, fontSize: 11, fontWeight: '600', marginTop: 3 },
});
