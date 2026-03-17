// app/(tabs)/scanner.tsx — Staff QR Check-In Scanner
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useSegments } from 'expo-router';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrPayload {
  b: string;
  h: string;
}

interface CheckinResult {
  bookingId:       string;
  customerName:    string;
  vehicleLabel:    string;
  serviceLabel:    string;
  appointmentDate: string;
  appointmentTime: string;
  locationType:    string;
  bayLabel:        string;
}

type ScanState = 'scanning' | 'processing' | 'success' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseQrData(raw: string): QrPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj?.b === 'string' && typeof obj?.h === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={ov.detailRow}>
      <View style={ov.detailIconWrap}>
        <Ionicons name={icon as any} size={13} color={Colors.white} />
      </View>
      <Text style={ov.detailText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({
  state,
  result,
  errorMsg,
  slideAnim,
  onReset,
  onViewJob,
}: {
  state:     ScanState;
  result:    CheckinResult | null;
  errorMsg:  string;
  slideAnim: Animated.Value;
  onReset:   () => void;
  onViewJob: (id: string) => void;
}) {
  if (state === 'scanning') return null;

  const isSuccess = state === 'success';
  const isError   = state === 'error';

  return (
    <Animated.View
      style={[
        ov.sheet,
        { transform: [{ translateY: slideAnim }] },
        isSuccess ? ov.sheetSuccess : isError ? ov.sheetError : ov.sheetProcessing,
      ]}
    >
      {/* Processing */}
      {state === 'processing' && (
        <View style={ov.processingRow}>
          <ActivityIndicator color={Colors.white} size="small" />
          <Text style={ov.processingText}>Verifying QR…</Text>
        </View>
      )}

      {/* Error */}
      {isError && (
        <>
          <View style={ov.iconRow}>
            <View style={ov.iconCircle}>
              <Ionicons name="close" size={28} color={Colors.white} />
            </View>
          </View>
          <Text style={ov.errorTitle}>Check-In Failed</Text>
          <Text style={ov.errorMsg}>{errorMsg}</Text>
          <Pressable
            style={ov.actionBtn}
            onPress={onReset}
            android_ripple={{ color: Colors.accent + '12', borderless: false }}
          >
            <Text style={ov.actionBtnText}>Scan Again</Text>
          </Pressable>
        </>
      )}

      {/* Success */}
      {isSuccess && result && (
        <>
          <View style={ov.iconRow}>
            <View style={ov.iconCircle}>
              <Ionicons name="checkmark" size={30} color={Colors.white} />
            </View>
          </View>
          <Text style={ov.successTitle}>Customer Checked In!</Text>

          <View style={ov.summaryCard}>
            <DetailRow icon="person"           value={result.customerName} />
            <DetailRow icon="car-outline"      value={result.vehicleLabel || 'Vehicle not specified'} />
            <DetailRow icon="layers"           value={result.serviceLabel} />
            <DetailRow icon="time-outline"     value={`${result.appointmentDate}  ·  ${result.appointmentTime}`} />
            {result.locationType === 'bay' && result.bayLabel && (
              <DetailRow icon="business-outline" value={result.bayLabel} />
            )}
          </View>

          <Text style={ov.pushNote}>
            Customer has been notified that their wash has started.
          </Text>

          <View style={ov.btnRow}>
            <Pressable
              style={ov.ghostBtn}
              onPress={() => onViewJob(result.bookingId)}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Text style={ov.ghostBtnText}>View Job</Text>
            </Pressable>
            <Pressable
              style={ov.actionBtn}
              onPress={onReset}
              android_ripple={{ color: Colors.accent + '12', borderless: false }}
            >
              <Text style={ov.actionBtnText}>Scan Next</Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Animated scan line ───────────────────────────────────────────────────────

function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <Animated.View
      style={[sc.scanLine, { transform: [{ translateY }] }]}
      pointerEvents="none"
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const { user } = useAuth();
  const segments   = useSegments();
  const routeGroup = `/${segments[0]}`; // '/(tabs)' or '/(staff)'

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState,  setScanState]      = useState<ScanState>('scanning');
  const [result,     setResult]         = useState<CheckinResult | null>(null);
  const [errorMsg,   setErrorMsg]       = useState('');

  const slideAnim   = useRef(new Animated.Value(400)).current;
  const cooldownRef = useRef(false);
  const mountedRef  = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const shown = scanState !== 'scanning';
    Animated.spring(slideAnim, {
      toValue:        shown ? 0 : 400,
      useNativeDriver: true,
      bounciness:     shown ? 6 : 0,
    }).start();
  }, [scanState]);

  const reset = useCallback(() => {
    setScanState('scanning');
    setResult(null);
    setErrorMsg('');
    cooldownRef.current = false;
  }, []);

  const handleBarcode = useCallback(async ({ data }: { data: string }) => {
    if (cooldownRef.current || scanState !== 'scanning') return;
    cooldownRef.current = true;

    const parsed = parseQrData(data);
    if (!parsed) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!mountedRef.current) return;
      setErrorMsg('Not a valid Wash Hub QR code. Ask the customer to show their booking QR.');
      setScanState('error');
      return;
    }

    setScanState('processing');

    try {
      const { data: checkin } = await axios.post<CheckinResult>(
        `/api/bookings/${parsed.b}/checkin`,
        { h: parsed.h }
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!mountedRef.current) return;
      setResult(checkin);
      setScanState('success');
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!mountedRef.current) return;
      const msg = err.response?.data?.error ?? 'Check-in failed. Please try again.';
      setErrorMsg(msg);
      setScanState('error');
    }
  }, [scanState]);

  const handleViewJob = useCallback((bookingId: string) => {
    router.push({ pathname: `${routeGroup}/jobs/[id]` as any, params: { id: bookingId } });
  }, [routeGroup]);

  // Permission loading
  if (!permission) {
    return (
      <View style={sc.centered}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={sc.safe} edges={['top']}>
        <View style={sc.header}>
          <Pressable style={sc.headerBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={sc.headerTitle}>QR Scanner</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={sc.centered}>
          <View style={sc.permIconWrap}>
            <Ionicons name="camera-outline" size={36} color={Colors.textMuted} />
          </View>
          <Text style={sc.permTitle}>Camera Access Required</Text>
          <Text style={sc.permSub}>
            Allow camera access to scan customer check-in QR codes.
          </Text>
          <Pressable
            style={sc.permBtn}
            onPress={requestPermission}
            android_ripple={{ color: Colors.accent + '12', borderless: false }}
          >
            <Text style={sc.permBtnText}>Grant Camera Access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      {/* Full-screen camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanState === 'scanning' ? handleBarcode : undefined}
      />

      {/* Dimming panels around frame */}
      <View style={sc.viewfinderOverlay} pointerEvents="box-none">
        {/* Top bar */}
        <SafeAreaView edges={['top']} style={sc.topBar}>
          <Pressable style={sc.topBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          <Text style={sc.topTitle}>Scan Customer QR</Text>
          <Pressable
            style={sc.topBtn}
            onPress={() => router.push('/(tabs)/kiosk')}
            hitSlop={8}
          >
            <Ionicons name="tablet-landscape-outline" size={22} color={Colors.white} />
          </Pressable>
        </SafeAreaView>

        {/* Scanning frame */}
        <View style={sc.frameWrap} pointerEvents="none">
          <View style={sc.frame}>
            {/* Corner brackets */}
            <View style={[sc.corner, sc.cornerTL]} />
            <View style={[sc.corner, sc.cornerTR]} />
            <View style={[sc.corner, sc.cornerBL]} />
            <View style={[sc.corner, sc.cornerBR]} />

            {/* Animated scan line */}
            {scanState === 'scanning' && <ScanLine />}
          </View>

          <Text style={sc.frameHint}>
            {scanState === 'scanning'   ? 'Position the QR code within the frame'
          : scanState === 'processing'  ? 'Verifying…'
          : ''}
          </Text>
        </View>

        {/* Staff pill */}
        <View style={sc.staffPill} pointerEvents="none">
          <View style={sc.staffDot} />
          <Text style={sc.staffName}>{user?.name ?? 'Staff'}</Text>
        </View>
      </View>

      {/* Result overlay */}
      <ResultOverlay
        state={scanState}
        result={result}
        errorMsg={errorMsg}
        slideAnim={slideAnim}
        onReset={reset}
        onViewJob={handleViewJob}
      />
    </View>
  );
}

// ─── Styles: scanner ─────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },

  // Permission screen
  permIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...cardShadow },
  permTitle:   { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  permSub:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  permBtn:     { backgroundColor: Colors.accent, borderRadius: borderRadius.md, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  permBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  // Viewfinder overlay
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  topBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },

  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame:     { width: 260, height: 260, position: 'relative', overflow: 'hidden' },

  // Corner brackets
  corner:    { position: 'absolute', width: 32, height: 32, borderColor: Colors.white, borderWidth: 3 },
  cornerTL:  { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR:  { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL:  { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 8 },
  cornerBR:  { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 8 },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 4, right: 4,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    opacity: 0.9,
    ...(IS_IOS ? { shadowColor: Colors.accent, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : {}),
  },

  frameHint: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', fontWeight: '500' },

  // Staff pill
  staffPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', alignSelf: 'center',
    borderRadius: borderRadius.full, paddingHorizontal: 16, paddingVertical: 8,
    marginBottom: 40,
  },
  staffDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  staffName: { color: Colors.white, fontSize: 13, fontWeight: '600' },
});

// ─── Styles: overlay ─────────────────────────────────────────────────────────

const ov = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: 24, paddingBottom: 48,
    ...(IS_IOS
      ? { shadowColor: Colors.black, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 20 }),
  },
  sheetSuccess:    { backgroundColor: Colors.success },
  sheetError:      { backgroundColor: Colors.error },
  sheetProcessing: { backgroundColor: Colors.textPrimary, paddingVertical: 20 },

  processingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText: { color: Colors.white, fontSize: 15, fontWeight: '600' },

  iconRow:   { alignItems: 'center', marginBottom: 12 },
  iconCircle:{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },

  successTitle: { fontSize: 22, fontWeight: '900', color: Colors.white, textAlign: 'center', marginBottom: 16 },
  errorTitle:   { fontSize: 20, fontWeight: '900', color: Colors.white, textAlign: 'center', marginBottom: 8 },
  errorMsg:     { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md, padding: 14, marginBottom: 12, gap: 8,
  },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIconWrap:{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  detailText:   { color: Colors.white, fontSize: 13, fontWeight: '600', flex: 1 },

  pushNote: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 18, lineHeight: 18 },

  btnRow:      { flexDirection: 'row', gap: 10 },
  actionBtn:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  actionBtnText:{ color: Colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn:    { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
