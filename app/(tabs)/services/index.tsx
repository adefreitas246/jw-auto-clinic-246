// app/(tabs)/services/index.tsx  — admin service list
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

import { Service } from '@/types/catalog';

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

function ServiceRow({
  service,
  onToggle,
  onEdit,
  onDelete,
}: {
  service: Service;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const confirmDelete = () => {
    swipeRef.current?.close();
    Alert.alert('Delete Service', `Remove "${service.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={prog => (
        <RightActions
          progress={prog}
          onEdit={() => { swipeRef.current?.close(); onEdit(); }}
          onDelete={confirmDelete}
        />
      )}
      overshootRight={false}
    >
      <View style={[s.row, !service.active && s.rowInactive]}>
        <View style={s.rowBody}>
          <Text style={[s.rowName, !service.active && s.textMuted]}>{service.name}</Text>
          <Text style={s.rowMeta}>
            {service.category}  ·  ${service.price.toFixed(2)}  ·  {service.duration} min
          </Text>
        </View>
        <Switch
          value={service.active}
          onValueChange={onToggle}
          trackColor={{ true: '#6a0dad', false: '#ccc' }}
          thumbColor="#fff"
        />
      </View>
    </Swipeable>
  );
}

export default function ManageServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<Service[]>('/api/services');
      setServices(res.data);
    } catch {
      Alert.alert('Error', 'Could not load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (svc: Service, active: boolean) => {
    try {
      const res = await axios.put<Service>(`/api/services/${svc._id}`, { active });
      setServices(prev => prev.map(s => (s._id === svc._id ? res.data : s)));
    } catch {
      Alert.alert('Error', 'Could not update service.');
    }
  };

  const deleteService = async (id: string) => {
    try {
      await axios.delete(`/api/services/${id}`);
      setServices(prev => prev.filter(s => s._id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete service.');
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#6a0dad" size="large" /></View>;
  }

  return (
    <View style={s.container}>
      {services.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="construct-outline" size={48} color="#ccc" />
          <Text style={s.emptyText}>No services yet. Tap + to add one.</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={services}
          keyExtractor={sv => sv._id}
          renderItem={({ item }) => (
            <ServiceRow
              service={item}
              onToggle={active => toggleActive(item, active)}
              onEdit={() => router.push(`/(tabs)/services/${item._id}`)}
              onDelete={() => deleteService(item._id)}
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
        onPress={() => router.push('/(tabs)/services/add')}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
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

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6a0dad',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
});

const a = StyleSheet.create({
  actions:   { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  btn:       { width: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, marginLeft: 4 },
  editBtn:   { backgroundColor: '#4a90e2' },
  deleteBtn: { backgroundColor: '#e25555' },
  btnText:   { color: '#fff', fontSize: 11, marginTop: 2 },
});
