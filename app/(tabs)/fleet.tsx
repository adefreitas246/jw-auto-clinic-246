// app/(tabs)/fleet.tsx — Fleet Map
// Full-screen live map of all active technicians.
// Polls GET /api/staff/locations every 30 s.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrentJob {
  _id: string;
  customerName: string;
  address: string;
}

interface FleetMember {
  _id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
  currentLat: number;
  currentLng: number;
  locationUpdatedAt: string | null;
  currentJob: CurrentJob | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;
const BOTTOM_SHEET_H = 200;

const DEFAULT_REGION = {
  latitude:       -23.5505,
  longitude:      -46.6333,
  latitudeDelta:   0.15,
  longitudeDelta:  0.15,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAgo(iso: string | null): string {
  if (!iso) return 'Unknown';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function regionForCoords(members: FleetMember[]) {
  if (!members.length) return DEFAULT_REGION;
  const lats = members.map(m => m.currentLat);
  const lngs = members.map(m => m.currentLng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const PAD = 0.02;
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  Math.max(maxLat - minLat + PAD, 0.01),
    longitudeDelta: Math.max(maxLng - minLng + PAD, 0.01),
  };
}

function statusColor(status: FleetMember['status']): string {
  if (status === 'active') return Colors.success;
  if (status === 'idle')   return Colors.warning;
  return Colors.textMuted;
}

function statusLabel(status: FleetMember['status']): string {
  if (status === 'active') return 'Active';
  if (status === 'idle')   return 'Idle';
  return 'Offline';
}

// ─── Lazy-require react-native-maps ──────────────────────────────────────────

let MapView: any = null;
let Marker:  any = null;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker  = Maps.Marker;
} catch {}

// ─── TechMarker ───────────────────────────────────────────────────────────────

function TechMarker({ member, selected }: { member: FleetMember; selected: boolean }) {
  const color = statusColor(member.status);
  return (
    <View style={fl.markerWrap}>
      <View style={[
        fl.markerCircle,
        { backgroundColor: color, borderColor: selected ? Colors.white : color },
        selected && fl.markerCircleSel,
      ]}>
        <Text style={fl.markerInitials}>{initials(member.name)}</Text>
      </View>
      <View style={[fl.markerNib, { borderTopColor: color }]} />
    </View>
  );
}

// ─── TechRow (bottom sheet) ───────────────────────────────────────────────────

function TechRow({ member, onPress }: { member: FleetMember; onPress: () => void }) {
  const color = statusColor(member.status);
  return (
    <Pressable
      style={fl.techRow}
      onPress={onPress}
      android_ripple={{ color: Colors.accent + '20', borderless: false }}
    >
      <View style={[fl.techAvatar, { backgroundColor: color + '20' }]}>
        <Text style={[fl.techAvatarText, { color }]}>{initials(member.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={fl.techName}>{member.name}</Text>
        <Text style={fl.techLocation} numberOfLines={1}>
          {member.currentJob ? member.currentJob.address : 'No active job'}
        </Text>
      </View>
      <View style={[fl.statusDot, { backgroundColor: color }]} />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();

  const [fleet,      setFleet]      = useState<FleetMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<FleetMember | null>(null);

  const mapRef      = useRef<any>(null);
  const slideAnim   = useRef(new Animated.Value(500)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFitted    = useRef(false);

  // Slide info card in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         selected ? 0 : 500,
      useNativeDriver: true,
      bounciness:      4,
    }).start();
  }, [selected]);

  // Fetch fleet data
  const fetchFleet = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const { data } = await axios.get<FleetMember[]>('/api/staff/locations');
      setFleet(data);
      if (!isFitted.current && data.length) {
        isFitted.current = true;
        setTimeout(() => mapRef.current?.animateToRegion(regionForCoords(data), 600), 300);
      }
      setSelected(prev => prev ? (data.find(m => m._id === prev._id) ?? null) : null);
    } catch {
      // silently fail on poll errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    intervalRef.current = setInterval(() => fetchFleet(), POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFleet]);

  // Marker / row press
  const handleMarkerPress = useCallback((member: FleetMember) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => prev?._id === member._id ? null : member);
    mapRef.current?.animateToRegion({
      latitude:       member.currentLat,
      longitude:      member.currentLng,
      latitudeDelta:  0.008,
      longitudeDelta: 0.008,
    }, 400);
  }, []);

  // Web fallback
  if (Platform.OS === 'web') {
    return (
      <View style={[fl.centered, { paddingTop: insets.top }]}>
        <Ionicons name="map-outline" size={40} color={Colors.accent} />
        <Text style={fl.emptyTitle}>Fleet Map</Text>
        <Text style={fl.emptyText}>Live map view is available on the mobile app.</Text>
      </View>
    );
  }

  const activeCount = fleet.filter(m => m.status === 'active').length;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surfaceAlt }}>

      {/* ── Full-screen map ── */}
      {loading || !MapView ? (
        <View style={fl.mapPlaceholder}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={[fl.emptyText, { marginTop: 12 }]}>Loading fleet map…</Text>
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

      {/* ── Floating back button (top left) ── */}
      <Pressable
        style={[fl.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </Pressable>

      {/* ── Header overlay card (top right) ── */}
      <View style={[fl.headerCard, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={{ flex: 1 }}>
          <Text style={fl.headerTitle}>Fleet Map</Text>
          <Text style={fl.headerSub}>
            {activeCount} technician{activeCount !== 1 ? 's' : ''} active
          </Text>
        </View>
        <Pressable
          style={fl.refreshBtn}
          onPress={() => fetchFleet(true)}
          disabled={refreshing}
          hitSlop={8}
          pointerEvents="auto"
        >
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="sync-outline" size={18} color={Colors.accent} />
          }
        </Pressable>
      </View>

      {/* ── Empty state overlay ── */}
      {!loading && fleet.length === 0 && (
        <View style={fl.emptyOverlay} pointerEvents="none">
          <View style={fl.emptyCard}>
            <Ionicons name="navigate-circle-outline" size={36} color={Colors.border} />
            <Text style={fl.emptyCardTitle}>No active technicians</Text>
            <Text style={fl.emptyCardSub}>
              Staff members appear here once they start their shift.
            </Text>
          </View>
        </View>
      )}

      {/* ── Bottom sheet — always visible ── */}
      <View style={fl.bottomSheet}>
        <View style={fl.handle} />
        <Text style={fl.sheetTitle}>Active Technicians</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {fleet.length === 0 ? (
            <Text style={fl.noTechText}>No technicians currently active</Text>
          ) : (
            fleet.map(member => (
              <TechRow
                key={member._id}
                member={member}
                onPress={() => handleMarkerPress(member)}
              />
            ))
          )}
        </ScrollView>
      </View>

      {/* ── Technician info card — slides up on marker tap ── */}
      <Animated.View
        style={[
          fl.infoCard,
          { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 },
        ]}
        pointerEvents={selected ? 'auto' : 'none'}
      >
        <View style={fl.infoHandle} />

        {selected && (
          <>
            {/* Avatar + name + close */}
            <View style={fl.infoHeaderRow}>
              <View style={[fl.infoAvatar, { backgroundColor: statusColor(selected.status) + '20' }]}>
                <Text style={[fl.infoAvatarText, { color: statusColor(selected.status) }]}>
                  {initials(selected.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fl.infoName}>{selected.name}</Text>
                <Text style={fl.infoRole}>{selected.role}</Text>
              </View>
              <Pressable
                style={fl.closeBtn}
                onPress={() => setSelected(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Status badge */}
            <View style={[fl.statusBadge, { backgroundColor: statusColor(selected.status) + '18' }]}>
              <View style={[fl.statusDot, { backgroundColor: statusColor(selected.status) }]} />
              <Text style={[fl.statusBadgeText, { color: statusColor(selected.status) }]}>
                {statusLabel(selected.status)}
              </Text>
            </View>

            {/* Current job */}
            {selected.currentJob ? (
              <View style={fl.infoRow}>
                <View style={fl.infoRowIcon}>
                  <Ionicons name="car-outline" size={14} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fl.infoRowLabel}>Current Job</Text>
                  <Text style={fl.infoRowValue}>{selected.currentJob.customerName}</Text>
                  <Text style={fl.infoRowSub} numberOfLines={1}>{selected.currentJob.address}</Text>
                </View>
              </View>
            ) : (
              <View style={fl.infoRow}>
                <View style={fl.infoRowIcon}>
                  <Ionicons name="car-outline" size={14} color={Colors.textMuted} />
                </View>
                <Text style={fl.infoRowSub}>No active job</Text>
              </View>
            )}

            {/* Last location update */}
            <View style={fl.infoRow}>
              <View style={fl.infoRowIcon}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
              </View>
              <Text style={fl.infoRowSub}>
                Last updated {formatAgo(selected.locationUpdatedAt)}
              </Text>
            </View>

            {/* View Jobs button */}
            <Pressable
              style={fl.viewJobsBtn}
              onPress={() => {
                const staffId = selected._id;
                setSelected(null);
                router.push(`/jobs?staffId=${staffId}` as any);
              }}
            >
              <Ionicons name="briefcase-outline" size={16} color={Colors.white} />
              <Text style={fl.viewJobsBtnText}>View Jobs</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fl = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: SCREEN_PADDING,
    backgroundColor: Colors.background,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  mapPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
  },

  // Floating back button
  backBtn: {
    position: 'absolute', left: 16, zIndex: 100,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...cardShadow,
  },

  // Header overlay card (top right)
  headerCard: {
    position: 'absolute', right: 16, zIndex: 100,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: borderRadius.xl,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: 220,
    ...cardShadow,
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  headerSub:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  refreshBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },

  // Markers
  markerWrap: { alignItems: 'center' },
  markerCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    ...cardShadow,
  },
  markerCircleSel: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 3, borderColor: Colors.white,
  },
  markerInitials: { fontSize: 14, fontWeight: '800', color: Colors.white },
  markerNib: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: BOTTOM_SHEET_H,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    borderTopWidth: 1, borderColor: Colors.border,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
      android: { elevation: 10 },
    }),
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },

  // Tech row
  techRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  techAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  techAvatarText: { fontSize: 13, fontWeight: '800' },
  techName:       { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  techLocation:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  statusDot:      { width: 10, height: 10, borderRadius: 5 },
  noTechText:     { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  // Info card (slides up over bottom sheet)
  infoCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
    }),
  },
  infoHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 20,
  },
  infoHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  infoAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  infoAvatarText: { fontSize: 18, fontWeight: '800' },
  infoName:       { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  infoRole:       { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: 16,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 12,
  },
  infoRowIcon: {
    width: 28, height: 28, borderRadius: borderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  infoRowLabel: {
    fontSize: 10, color: Colors.textMuted,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  infoRowValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  infoRowSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // View Jobs button
  viewJobsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    marginTop: 4,
  },
  viewJobsBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // Empty state
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: BOTTOM_SHEET_H + 16,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.xl, padding: 24,
    alignItems: 'center', gap: 8, marginHorizontal: 32,
    ...cardShadow,
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptyCardSub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
