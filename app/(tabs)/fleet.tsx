// app/(tabs)/fleet.tsx — Admin Fleet Map
// Shows all currently-tracking staff members on a live map.
// Polls GET /api/staff/fleet every 30 s. Admin only.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

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
      <View style={fl.markerNib} />
    </View>
  );
}

// ─── Detail card (slide-up) ───────────────────────────────────────────────────

function DetailCard({
  member,
  onClose,
  slideAnim,
}: {
  member: FleetMember | null;
  onClose: () => void;
  slideAnim: Animated.Value;
}) {
  if (!member) return null;

  return (
    <Animated.View
      style={[
        fl.detailCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Handle */}
      <View style={fl.handle} />

      {/* Avatar + name row */}
      <View style={fl.detailRow}>
        <View style={fl.detailAvatar}>
          <Text style={fl.detailInitials}>{initials(member.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fl.detailName}>{member.name}</Text>
          <View style={fl.detailBadgeRow}>
            <View style={fl.onlineDot} />
            <Text style={fl.onlineText}>Online</Text>
            <Text style={fl.rolePill}>{member.role}</Text>
          </View>
        </View>
        <Pressable style={fl.closeBtn} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Coordinates row */}
      <View style={fl.detailInfoRow}>
        <Ionicons name="location-outline" size={15} color={Colors.accent} />
        <Text style={fl.detailInfoText}>
          {member.currentLat.toFixed(5)}°, {member.currentLng.toFixed(5)}°
        </Text>
        {member.locationAccuracy != null && (
          <Text style={fl.accuracyChip}>±{Math.round(member.locationAccuracy)} m</Text>
        )}
      </View>

      {/* Last seen row */}
      <View style={fl.detailInfoRow}>
        <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
        <Text style={fl.detailInfoSub}>
          Last seen {formatAgo(member.locationUpdatedAt)}
        </Text>
      </View>
    </Animated.View>
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
          <Ionicons name="lock-closed-outline" size={40} color={Colors.border} />
          <Text style={fl.emptyText}>Admin access required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={fl.safe} edges={['top']}>
        <View style={fl.centered}>
          <Ionicons name="map-outline" size={48} color={Colors.accent} />
          <Text style={[fl.emptyText, { marginTop: 12 }]}>Fleet Map</Text>
          <Text style={[fl.emptyText, { fontSize: 14, color: Colors.textSecondary, marginTop: 4 }]}>
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

      {/* ── Floating header overlay ── */}
      <SafeAreaView style={fl.headerOverlay} edges={['top']} pointerEvents="box-none">
        <View style={fl.header}>
          {/* Back */}
          <Pressable style={fl.headerBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>

          {/* Title + count */}
          <View style={fl.headerCenter}>
            <Text style={fl.headerTitle}>Fleet Map</Text>
            <View style={fl.countChip}>
              <View style={fl.chipDot} />
              <Text style={fl.countText}>{fleet.length} active</Text>
            </View>
          </View>

          {/* Refresh + fit */}
          <View style={fl.headerActions}>
            <Pressable
              style={fl.headerBtn}
              onPress={() => fetchFleet(true)}
              hitSlop={8}
              disabled={refreshing}
            >
              {refreshing
                ? <ActivityIndicator size="small" color={Colors.accent} />
                : <Ionicons name="refresh" size={20} color={Colors.accent} />
              }
            </Pressable>
            <Pressable style={fl.headerBtn} onPress={fitAll} hitSlop={8}>
              <Ionicons name="expand-outline" size={20} color={Colors.accent} />
            </Pressable>
          </View>
        </View>

        {/* Last refreshed */}
        {lastRefresh && (
          <View style={fl.refreshedBadge}>
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
            <Text style={fl.emptyTitle}>No active technicians</Text>
            <Text style={fl.emptySub}>Staff members will appear here once they start their shift.</Text>
          </View>
        </View>
      )}

      {/* ── Detail card (bottom slide-up) ── */}
      <DetailCard
        member={selected}
        onClose={() => setSelected(null)}
        slideAnim={slideAnim}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW = Platform.select({
  ios:     { shadowColor: Colors.black, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 6 },
}) ?? {};

const fl = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f7f7fb' },
  centered:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0edf8' },

  // ── Floating header ──
  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginHorizontal: 12,
    marginTop:        8,
    backgroundColor: Colors.white,
    borderRadius:    16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    ...SHADOW,
  },
  headerBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  headerActions:{ flexDirection: 'row', alignItems: 'center' },

  countChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0edf8', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  chipDot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.success },
  countText:  { fontSize: 12, fontWeight: '700', color: Colors.accent },

  refreshedBadge: {
    alignSelf: 'center', marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  refreshedText: { fontSize: 11, color: Colors.textMuted },

  // ── Markers ──
  markerWrap: {
    alignItems: 'center',
  },
  markerWrapSel: {},
  markerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
    ...SHADOW,
  },
  markerAvatarSel: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#4a0090',
    borderWidth: 3, borderColor: Colors.white,
  },
  markerInitials:    { fontSize: 13, fontWeight: '800', color: Colors.white },
  markerInitialsSel: { fontSize: 16 },
  markerName: {
    fontSize: 11, fontWeight: '700', color: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 2, maxWidth: 70,
    textAlign: 'center',
  },
  markerNameSel: { color: Colors.accent },
  markerNib: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.accent,
  },

  // ── Detail card ──
  detailCard: {
    position:       'absolute',
    bottom:         0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop:   10,
    paddingBottom: 36,
    ...SHADOW,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  detailAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  detailInitials: { fontSize: 18, fontWeight: '800', color: Colors.white },
  detailName:     { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  detailBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  onlineDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  onlineText:     { fontSize: 12, color: Colors.success, fontWeight: '600' },
  rolePill: {
    fontSize: 11, color: Colors.accent, fontWeight: '700',
    backgroundColor: '#f0edf8', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  detailInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  detailInfoText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  detailInfoSub:  { fontSize: 13, color: Colors.textMuted, flex: 1 },
  accuracyChip: {
    fontSize: 11, color: Colors.textMuted,
    backgroundColor: Colors.background, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },

  // ── Error toast ──
  errorToast: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: '#fff3f3',
    borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
    ...SHADOW,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '600' },

  // ── Empty state overlay ──
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8,
    marginHorizontal: 32,
    ...SHADOW,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptySub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
});
