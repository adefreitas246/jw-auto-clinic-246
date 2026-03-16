// app/(tabs)/services/index.tsx — admin service list
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

import { Service } from '@/types/catalog';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ─── Category badge colors ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  General:  Colors.info,
  Exterior: Colors.accent,
  Interior: Colors.primary,
  Detail:   Colors.success,
  Premium:  Colors.warning,
  Other:    Colors.textMuted,
};

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

// ─── Service card ─────────────────────────────────────────────────────────────

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

  const badgeColor = CATEGORY_COLORS[service.category] ?? Colors.textMuted;

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
      <View style={[s.card, !service.active && s.cardInactive]}>
        {/* Left: name + meta */}
        <View style={s.cardBody}>
          {/* Category badge */}
          <View style={[s.badge, { backgroundColor: badgeColor + '18' }]}>
            <View style={[s.badgeDot, { backgroundColor: badgeColor }]} />
            <Text style={[s.badgeText, { color: badgeColor }]}>{service.category}</Text>
          </View>

          <Text style={[s.name, !service.active && s.textMuted]} numberOfLines={1}>
            {service.name}
          </Text>

          <View style={s.metaRow}>
            <View style={s.metaChip}>
              <Ionicons name="pricetag-outline" size={11} color={Colors.textMuted} />
              <Text style={s.metaText}>${service.price.toFixed(2)}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaChip}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={s.metaText}>{service.duration} min</Text>
            </View>
          </View>
        </View>

        {/* Right: toggle */}
        <Switch
          value={service.active}
          onValueChange={onToggle}
          trackColor={{ true: Colors.accent, false: Colors.border }}
          thumbColor={Colors.white}
        />
      </View>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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
        {services.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyIcon}>
              <Ionicons name="construct-outline" size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No services yet</Text>
            <Text style={s.emptyText}>Tap the + button to add your first service.</Text>
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
            contentContainerStyle={s.list}
            onRefresh={load}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* FAB */}
        <Pressable
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(tabs)/services/add')}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    ...cardShadow,
  },
  cardInactive: { opacity: 0.5 },
  cardBody:     { flex: 1, marginRight: 12 },

  // Badge
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  name:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  textMuted:{ color: Colors.textMuted },

  metaRow:    { flexDirection: 'row', alignItems: 'center' },
  metaChip:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 12, color: Colors.textMuted },
  metaDivider:{ width: 1, height: 10, backgroundColor: Colors.border, marginHorizontal: 8 },

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
