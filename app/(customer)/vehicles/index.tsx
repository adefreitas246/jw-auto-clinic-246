// app/(customer)/vehicles/index.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated2, { FadeInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useVehicles } from '@/hooks/useVehicles';
import { Vehicle } from '@/types/vehicle';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { EmptyState, ScreenHeader } from '@/components/ui';

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
      <Pressable
        style={[styles.actionBtn, styles.editBtn]}
        onPress={onEdit}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        <Ionicons name="create-outline" size={20} color={Colors.white} />
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
      <Pressable
        style={[styles.actionBtn, styles.deleteBtn]}
        onPress={onDelete}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        <Ionicons name="trash-outline" size={20} color={Colors.white} />
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Plate badge ─────────────────────────────────────────────────────────────
function PlateBadge({ plate }: { plate: string }) {
  return (
    <View style={styles.plateBadge}>
      <Text style={styles.plateBadgeText}>{plate}</Text>
    </View>
  );
}

// ─── Size tag ─────────────────────────────────────────────────────────────────
function SizeTag({ size }: { size: string }) {
  return (
    <View style={styles.sizeTag}>
      <Text style={styles.sizeTagText}>{size}</Text>
    </View>
  );
}

// ─── Vehicle card ────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
  index,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    <Animated2.View entering={FadeInDown.delay(index * 80).duration(300)}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={(progress) => (
          <RightActions progress={progress} onEdit={handleEdit} onDelete={handleDelete} />
        )}
        overshootRight={false}
      >
        <View style={styles.card}>
          {/* Icon circle */}
          <View style={styles.cardIconWrap}>
            <Ionicons name="car-sport-outline" size={24} color={Colors.accent} />
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                {vehicle.make} {vehicle.model}
              </Text>
            </View>

            <View style={styles.cardMetaRow}>
              {!!vehicle.size && <SizeTag size={vehicle.size} />}
              {!!vehicle.color && (
                <Text style={styles.cardColor}>{vehicle.color}</Text>
              )}
            </View>

            {!!vehicle.licensePlate && (
              <PlateBadge plate={vehicle.licensePlate} />
            )}

            {!!vehicle.notes && (
              <Text style={styles.cardNotes} numberOfLines={1}>
                {vehicle.notes}
              </Text>
            )}
          </View>

          <View style={styles.chevronCircle}>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </View>
        </View>
      </Swipeable>
    </Animated2.View>
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScreenHeader
          title="My Vehicles"
          rightAction={{ label: 'Add', icon: 'add', onPress: () => router.push('/(customer)/vehicles/add') }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScreenHeader
        title="My Vehicles"
        rightAction={{ label: 'Add', icon: 'add', onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(customer)/vehicles/add');
        }}}
      />

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={refresh}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {vehicles.length === 0 && !error ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<Ionicons name="car-outline" size={40} color={Colors.accent} />}
            title="No Vehicles Added"
            subtitle="Add your first vehicle to start booking"
            actionLabel="Add Vehicle"
            onAction={() => router.push('/(customer)/vehicles/add')}
          />
        </View>
      ) : (
        <Animated.FlatList
          data={vehicles}
          keyExtractor={(v) => v._id}
          renderItem={({ item, index }) => (
            <VehicleCard
              vehicle={item}
              index={index}
              onEdit={() => router.push(`/(customer)/vehicles/${item._id}`)}
              onDelete={() => handleDelete(item._id)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refresh}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.88 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(customer)/vehicles/add');
        }}
        android_ripple={{ color: Colors.accent + '20', borderless: false }}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:       { flex: 1, backgroundColor: Colors.background },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SCREEN_PADDING },
  emptyContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: SCREEN_PADDING },
  list:           { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 100 },
  separator:      { height: 10 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...cardShadow,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  cardBody:      { flex: 1 },
  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardColor:     { fontSize: 12, color: Colors.textSecondary },
  cardNotes:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },

  // Plate badge
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.chrome,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  plateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 1.5,
  },

  // Size tag
  sizeTag: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sizeTagText: { fontSize: 11, fontWeight: '600', color: Colors.accent },

  // Swipe actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionBtn: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    marginLeft: 4,
    gap: 4,
  },
  editBtn:    { backgroundColor: Colors.accent },
  deleteBtn:  { backgroundColor: Colors.error },
  actionText: { color: Colors.white, fontSize: 11, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    right: SCREEN_PADDING,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_IOS
      ? { shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 8 }),
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    marginHorizontal: SCREEN_PADDING,
    marginTop: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorText:  { flex: 1, color: Colors.errorText, fontSize: 13 },
  retryText:  { color: Colors.accent, fontWeight: '700', fontSize: 13 },
});
