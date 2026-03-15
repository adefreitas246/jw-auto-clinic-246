// app/(customer)/vehicles/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { useVehicles } from '@/hooks/useVehicles';
import { Vehicle } from '@/types/vehicle';

// ─── Swipeable right actions ────────────────────────────────────────────────
function RightActions({
  progress,
  onEdit,
  onDelete,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const translateX = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [128, 0],
  });
  return (
    <Animated.View style={[styles.actions, { transform: [{ translateX }] }]}>
      <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color="#fff" />
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Vehicle card ────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert(
      'Delete Vehicle',
      `Remove ${vehicle.make} ${vehicle.model}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  const handleEdit = () => {
    swipeRef.current?.close();
    onEdit();
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(progress) => (
        <RightActions progress={progress} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      overshootRight={false}
    >
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons name="car-outline" size={28} color="#6a0dad" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Text style={styles.cardSub}>
            {[vehicle.size, vehicle.color, vehicle.licensePlate]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
          {!!vehicle.notes && (
            <Text style={styles.cardNotes} numberOfLines={1}>
              {vehicle.notes}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </Swipeable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function VehicleListScreen() {
  const { vehicles, loading, error, deleteVehicle, refresh } = useVehicles();

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id);
    } catch {
      Alert.alert('Error', 'Could not delete vehicle. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6a0dad" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {vehicles.length === 0 && !error ? (
        <View style={styles.center}>
          <Ionicons name="car-outline" size={56} color="#ccc" />
          <Text style={styles.emptyTitle}>No vehicles yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your car to speed up future bookings.
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={vehicles}
          keyExtractor={(v) => v._id}
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              onEdit={() => router.push(`/(customer)/vehicles/${item._id}`)}
              onDelete={() => handleDelete(item._id)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refresh}
          refreshing={loading}
        />
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(customer)/vehicles/add')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16 },
  separator: { height: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3eafd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1f1f1f' },
  cardSub:   { fontSize: 13, color: '#666', marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#999', marginTop: 3 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionBtn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 4,
    paddingVertical: 10,
  },
  editBtn:   { backgroundColor: '#4a90e2' },
  deleteBtn: { backgroundColor: '#e25555' },
  actionText: { color: '#fff', fontSize: 11, marginTop: 2 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6a0dad',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#6a0dad', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },

  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: { color: '#c00', fontSize: 13, flex: 1 },
  retryText: { color: '#6a0dad', fontWeight: '600', marginLeft: 8 },

  emptyTitle:    { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6 },
});
