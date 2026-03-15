// app/(tabs)/packages/index.tsx — admin package list
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { Package, packagePrice } from '@/types/catalog';

function RightActions({
  progress,
  onEdit,
  onDelete,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const x = progress.interpolate({ inputRange: [0, 1], outputRange: [128, 0] });
  return (
    <Animated.View style={[a.actions, { transform: [{ translateX: x }] }]}>
      <Pressable style={[a.btn, a.editBtn]} onPress={onEdit}>
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={a.btnText}>Edit</Text>
      </Pressable>
      <Pressable style={[a.btn, a.deleteBtn]} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color="#fff" />
        <Text style={a.btnText}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

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
      <View style={[s.row, !pkg.active && s.rowInactive]}>
        <View style={s.rowBody}>
          <Text style={[s.rowName, !pkg.active && s.textMuted]}>{pkg.name}</Text>
          <Text style={s.rowMeta}>
            {pkg.serviceIds.length} service{pkg.serviceIds.length !== 1 ? 's' : ''}
            {'  ·  '}${packagePrice(pkg).toFixed(2)}
            {pkg.price == null ? ' (auto)' : ' (fixed)'}
          </Text>
          {!!pkg.description && (
            <Text style={s.rowDesc} numberOfLines={1}>{pkg.description}</Text>
          )}
        </View>
        <Switch
          value={pkg.active}
          onValueChange={onToggle}
          trackColor={{ true: '#6a0dad', false: '#ccc' }}
          thumbColor="#fff"
        />
      </View>
    </Swipeable>
  );
}

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
    return <View style={s.center}><ActivityIndicator color="#6a0dad" size="large" /></View>;
  }

  return (
    <View style={s.container}>
      {packages.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="albums-outline" size={48} color="#ccc" />
          <Text style={s.emptyText}>No packages yet. Tap + to create one.</Text>
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
          contentContainerStyle={{ padding: 16 }}
          onRefresh={load}
          refreshing={loading}
        />
      )}

      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(tabs)/packages/add')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7fb' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#aaa', marginTop: 12, fontSize: 14 },
  sep:       { height: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  rowInactive: { opacity: 0.55 },
  rowBody:     { flex: 1 },
  rowName:     { fontSize: 15, fontWeight: '600', color: '#1f1f1f' },
  textMuted:   { color: '#aaa' },
  rowMeta:     { fontSize: 12, color: '#888', marginTop: 2 },
  rowDesc:     { fontSize: 12, color: '#bbb', marginTop: 2 },
  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#6a0dad',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
});

const a = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  btn:     { width: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, marginLeft: 4 },
  editBtn:   { backgroundColor: '#4a90e2' },
  deleteBtn: { backgroundColor: '#e25555' },
  btnText:   { color: '#fff', fontSize: 11, marginTop: 2 },
});
