// app/(tabs)/fleet.tsx — Admin Fleet Map
// Shows all currently-tracking staff members on a live map.
// Polls GET /api/staff/fleet every 30 s. Admin only.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';
import { Avatar, Badge, SectionHeader } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FleetMember {
  _id: string;
  name: string;
  role: string;
  currentLat: number;
  currentLng: number;
  locationAccuracy: number | null;
  locationUpdatedAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;
const SCREEN_H = Dimensions.get('window').height;

// Default region when no techs are visible yet (broad view)
const DEFAULT_REGION: Region = {
  latitude:      -23.5505,
  longitude:     -46.6333,
  latitudeDelta:  0.15,
  longitudeDelta: 0.15,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAgo(isoString: string | null): string {
  if (!isoString) return 'Unknown';
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/** Derive initials from a name, max 2 chars. */
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

/** Fit a region around a list of coordinates with padding. */
function regionForCoords(members: FleetMember[]): Region {
  if (!members.length) return DEFAULT_REGION;
  const lats = members.map(m => m.currentLat);
  const lngs = members.map(m => m.currentLng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const PAD = 0.02;
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  Math.max(maxLat - minLat + PAD, 0.01),
    longitudeDelta: Math.max(maxLng - minLng + PAD, 0.01),
  };
}

// ─── Marker pin component ─────────────────────────────────────────────────────

function TechMarker({
  member,
  selected,
}: {
  member: FleetMember;
  selected: boolean;
}) {
  return (
    <View style={[fl.markerWrap, selected && fl.markerWrapSel]}>
      <View style={[fl.markerAvatar, selected && fl.markerAvatarSel]}>
        <Text style={[fl.markerInitials, selected && fl.markerInitialsSel]}>
          {initials(member.name)}
        </Text>
      </View>
      <Text style={[fl.markerName, selected && fl.markerNameSel]} numberOfLines={1}>
        {member.name.split(' ')[0]}
      </Text>
      <View style={[fl.markerNib, selected && fl.markerNibSel]} />
    </View>
  );
}

// ─── Technician list row ──────────────────────────────────────────────────────

function TechRow({ member, onPress }: { member: FleetMember; onPress: () => void }) {
  return (
    <Pressable
      style={fl.techRow}
      onPress={onPress}
      android_ripple={{ color: Colors.accent + '20', borderless: false }}
    >
      <Avatar name={member.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={fl.techName}>{member.name}</Text>
        <Text style={fl.techLastSeen}>Last seen {formatAgo(member.locationUpdatedAt)}</Text>
      </View>
      <View style={fl.techStatusDot} />
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const { user } = useAuth();

  const [fleet,       setFleet]       = useState<FleetMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [selected,    setSelected]    = useState<FleetMember | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const mapRef    = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFitted  = useRef(false);

  // ── Slide detail card in/out ───────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:        selected ? 0 : 300,
      useNativeDriver: true,
      bounciness:     4,
    }).start();
  }, [selected]);

  // ── Fetch fleet data ───────────────────────────────────────────────────────
  const fetchFleet = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const { data } = await axios.get<FleetMember[]>('/api/staff/fleet');
      setFleet(data);
      setError(null);
      setLastRefresh(new Date());

      // On first load, fit the map around all markers
      if (!isFitted.current && data.length) {
        isFitted.current = true;
        setTimeout(() => {
          mapRef.current?.animateToRegion(regionForCoords(data), 600);
        }, 300);
      }

      // If selected tech moved, keep selection data fresh
      setSelected(prev =>
        prev ? (data.find(m => m._id === prev._id) ?? null) : null
      );
    } catch {
      setError('Could not load fleet data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    intervalRef.current = setInterval(() => fetchFleet(), POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFleet]);

  // ── Marker press ──────────────────────────────────────────────────────────
  const handleMarkerPress = useCallback((member: FleetMember) => {
    if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => (prev?._id === member._id ? null : member));
    mapRef.current?.animateToRegion(
      {
        latitude:       member.currentLat,
        longitude:      member.currentLng,
        latitudeDelta:  0.008,
        longitudeDelta: 0.008,
      },
      400
    );
  }, []);

  // ── Fit all ───────────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    if (!fleet.length) return;
    setSelected(null);
    mapRef.current?.animateToRegion(regionForCoords(fleet), 600);
  }, [fleet]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={fl.safe} edges={['top']}>
        <View style={fl.centered}>
          <View style={fl.emptyIconWrap}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={fl.emptyTitle}>Admin access required</Text>
          <Text style={fl.emptyText}>This screen is only accessible to administrators.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={fl.safe} edges={['top']}>
        <View style={fl.centered}>
          <View style={fl.emptyIconWrap}>
            <Ionicons name="map-outline" size={32} color={Colors.accent} />
          </View>
          <Text style={fl.emptyTitle}>Fleet Map</Text>
          <Text style={fl.emptyText}>
            Live map view is available on the mobile app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ── Map (full screen) ── */}
      {loading ? (
        <View style={fl.mapPlaceholder}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPress={() => setSelected(null)}
        >
          {fleet.map(member => (
            <Marker
              key={member._id}
              coordinate={{ latitude: member.currentLat, longitude: member.currentLng }}
              onPress={() => handleMarkerPress(member)}
              tracksViewChanges={false}
            >
              <TechMarker member={member} selected={selected?._id === member._id} />
            </Marker>
          ))}
        </MapView>
      )}

      {/* ── Fixed header overlay with LinearGradient ── */}
      <SafeAreaView style={fl.headerOverlay} edges={['top']} pointerEvents="box-none">
        <LinearGradient
          colors={[Colors.primary, Colors.primary + 'CC', 'transparent']}
          style={fl.gradientOverlay}
          pointerEvents="none"
        />
        <View style={fl.header} pointerEvents="box-none">
          <View style={fl.headerContent}>
            <Text style={fl.headerTitle}>Fleet Tracking</Text>
            <Badge status="active" label={`${fleet.length} active`} size="sm" />
          </View>
          {/* Actions */}
          <View style={fl.headerActions}>
            <Pressable
              style={fl.headerIconBtn}
              onPress={() => {
                if (IS_IOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                fetchFleet(true);
              }}
              android_ripple={{ color: Colors.accent + '20', borderless: true, radius: 22 }}
              hitSlop={8}
              disabled={refreshing}
            >
              {refreshing
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="refresh" size={20} color={Colors.white} />
              }
            </Pressable>
            <Pressable
              style={fl.headerIconBtn}
              onPress={fitAll}
              android_ripple={{ color: Colors.accent + '20', borderless: true, radius: 22 }}
              hitSlop={8}
            >
              <Ionicons name="expand-outline" size={20} color={Colors.white} />
            </Pressable>
          </View>
        </View>

        {/* Last refreshed */}
        {lastRefresh && (
          <View style={fl.refreshedBadge} pointerEvents="none">
            <View style={fl.refreshedDot} />
            <Text style={fl.refreshedText}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Error toast ── */}
      {error && (
        <View style={fl.errorToast} pointerEvents="none">
          <Ionicons name="warning-outline" size={15} color={Colors.error} />
          <Text style={fl.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Empty state ── */}
      {!loading && !fleet.length && !error && (
        <View style={fl.emptyOverlay} pointerEvents="none">
          <View style={fl.emptyCard}>
            <Ionicons name="navigate-circle-outline" size={36} color={Colors.border} />
            <Text style={fl.emptyCardTitle}>No active technicians</Text>
            <Text style={fl.emptyCardSub}>Staff members will appear here once they start their shift.</Text>
          </View>
        </View>
      )}

      {/* ── Bottom sheet with technician list ── */}
      <View style={fl.bottomSheet} pointerEvents="box-none">
        {/* Handle bar */}
        <View style={fl.handle} />
        <SectionHeader
          title={`Active Technicians (${fleet.length})`}
        />
        <ScrollView showsVerticalScrollIndicator={false}>
          {fleet.map((member, index) => (
            <ReAnimated.View key={member._id} entering={FadeInDown.delay(index * 50).springify()}>
              <TechRow
                member={member}
                onPress={() => handleMarkerPress(member)}
              />
            </ReAnimated.View>
          ))}
          {fleet.length === 0 && (
            <Text style={fl.noTechText}>No technicians currently active</Text>
          )}
        </ScrollView>
      </View>

      {/* ── Detail card (bottom slide-up) when marker selected ── */}
      <Animated.View
        style={[
          fl.detailCard,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents={selected ? 'auto' : 'none'}
      >
        {/* Handle */}
        <View style={fl.detailHandle} />

        {selected && (
          <>
            {/* Avatar + name row */}
            <View style={fl.detailRow}>
              <View style={fl.detailAvatar}>
                <Text style={fl.detailInitials}>{initials(selected.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fl.detailName}>{selected.name}</Text>
                <View style={fl.detailBadgeRow}>
                  <View style={fl.onlineDot} />
                  <Text style={fl.onlineText}>Online</Text>
                  <View style={fl.rolePill}>
                    <Text style={fl.rolePillText}>{selected.role}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={fl.closeBtn}
                onPress={() => setSelected(null)}
                android_ripple={{ color: Colors.border, borderless: true, radius: 18 }}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Coordinates row */}
            <View style={fl.detailInfoRow}>
              <View style={fl.detailInfoIcon}>
                <Ionicons name="location-outline" size={15} color={Colors.accent} />
              </View>
              <Text style={fl.detailInfoText}>
                {selected.currentLat.toFixed(5)}°, {selected.currentLng.toFixed(5)}°
              </Text>
              {selected.locationAccuracy != null && (
                <View style={fl.accuracyChip}>
                  <Text style={fl.accuracyChipText}>±{Math.round(selected.locationAccuracy)} m</Text>
                </View>
              )}
            </View>

            {/* Last seen row */}
            <View style={fl.detailInfoRow}>
              <View style={fl.detailInfoIcon}>
                <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
              </View>
              <Text style={fl.detailInfoSub}>
                Last seen {formatAgo(selected.locationUpdatedAt)}
              </Text>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fl = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },

  // Centered empty states
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptyText:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Floating header with gradient
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  gradientOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 12,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle:   { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.full,
  },

  refreshedBadge: {
    alignSelf: 'center', marginTop: 4,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 4,
  },
  refreshedDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  refreshedText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Markers
  markerWrap:         { alignItems: 'center' },
  markerWrapSel:      {},
  markerAvatar: {
    width: 38, height: 38, borderRadius: borderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
    ...cardShadow,
  },
  markerAvatarSel: {
    width: 48, height: 48, borderRadius: borderRadius.full,
    backgroundColor: Colors.primary,
    borderWidth: 3, borderColor: Colors.white,
  },
  markerInitials:    { fontSize: 13, fontWeight: '800', color: Colors.white },
  markerInitialsSel: { fontSize: 16 },
  markerName: {
    fontSize: 11, fontWeight: '700', color: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: borderRadius.sm, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 2, maxWidth: 72, textAlign: 'center',
  },
  markerNameSel: { color: Colors.accent },
  markerNib: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.accent,
  },
  markerNibSel: { borderTopColor: Colors.primary },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
    maxHeight: SCREEN_H * 0.5,
    borderTopWidth: 1, borderColor: Colors.border,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
    }),
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },

  // Tech row in bottom sheet
  techRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  techName:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  techLastSeen: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  techStatusDot:{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  noTechText:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },

  // Detail card (slide-up over bottom sheet)
  detailCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12, paddingBottom: 40,
    ...cardShadow,
  },
  detailHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 20,
  },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  detailAvatar: {
    width: 52, height: 52, borderRadius: borderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.accent,
  },
  detailInitials:  { fontSize: 18, fontWeight: '800', color: Colors.accent },
  detailName:      { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  detailBadgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  onlineText:      { fontSize: 12, color: Colors.success, fontWeight: '700' },
  rolePill: {
    backgroundColor: Colors.accentMuted, borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  rolePillText: { fontSize: 11, color: Colors.accent, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  detailInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  detailInfoIcon: {
    width: 28, height: 28, borderRadius: borderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  detailInfoText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  detailInfoSub:  { fontSize: 13, color: Colors.textMuted, flex: 1 },
  accuracyChip: {
    backgroundColor: Colors.surfaceAlt, borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  accuracyChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Error toast
  errorToast: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: Colors.errorBg,
    borderRadius: borderRadius.md, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
    ...cardShadow,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '600' },

  // Empty state overlay
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.xl, padding: 24,
    alignItems: 'center', gap: 8,
    marginHorizontal: 32,
    ...cardShadow,
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptyCardSub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
