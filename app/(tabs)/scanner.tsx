// app/(tabs)/scanner.tsx — Staff QR Check-In Scanner (full screen)
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import ReAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow } from '@/utils/platformStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckinResult {
  jobId:        string;
  bookingId:    string;
  customerName: string;
  serviceName?: string;
  serviceLabel?:string;
  vehicleLabel?:string;
}

type ScanState = 'scanning' | 'processing' | 'success' | 'error';

// ── Constants ─────────────────────────────────────────────────────────────────

const CUTOUT_SIZE = 250;
const CORNER_SIZE = 20;
const CORNER_WIDTH = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBookingId(raw: string): string | null {
  try {
    const obj = JSON.parse(raw);
    // Accept { b: '...' } or { bookingId: '...' }
    const id = obj?.b ?? obj?.bookingId;
    if (typeof id === 'string' && id.length > 0) return id;
    return null;
  } catch {
    // Plain string bookingId
    if (/^[a-f0-9]{24}$/i.test(raw.trim())) return raw.trim();
    return null;
  }
}

// ── Animated scan line (Reanimated) ──────────────────────────────────────────

function ScanLine() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(CUTOUT_SIZE - 4, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <ReAnimated.View style={[sc.scanLine, animStyle]} pointerEvents="none" />;
}

// ── Result overlay (slides up from bottom) ────────────────────────────────────

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
          <Text style={ov.processingText}>Verifying QR code…</Text>
        </View>
      )}

      {/* Error */}
      {isError && (
        <>
          <View style={ov.iconRow}>
            <View style={ov.iconCircle}>
              <Ionicons name="close" size={30} color={Colors.white} />
            </View>
          </View>
          <Text style={ov.sheetTitle}>Check-In Failed</Text>
          <Text style={ov.sheetSub}>{errorMsg}</Text>
          <Pressable style={ov.primaryBtn} onPress={onReset} android_ripple={{ color: Colors.white + '20' }}>
            <Text style={ov.primaryBtnText}>Try Again</Text>
          </Pressable>
        </>
      )}

      {/* Success */}
      {isSuccess && result && (
        <>
          <View style={ov.iconRow}>
            <View style={ov.iconCircle}>
              <Ionicons name="checkmark" size={32} color={Colors.white} />
            </View>
          </View>
          <Text style={ov.sheetTitle}>Job Started!</Text>

          <View style={ov.infoCard}>
            <View style={ov.infoRow}>
              <Ionicons name="person-outline" size={14} color={Colors.white} />
              <Text style={ov.infoText} numberOfLines={1}>{result.customerName}</Text>
            </View>
            {(result.serviceName || result.serviceLabel) ? (
              <View style={ov.infoRow}>
                <Ionicons name="cut-outline" size={14} color={Colors.white} />
                <Text style={ov.infoText} numberOfLines={1}>{result.serviceName ?? result.serviceLabel}</Text>
              </View>
            ) : null}
            {result.vehicleLabel ? (
              <View style={ov.infoRow}>
                <Ionicons name="car-outline" size={14} color={Colors.white} />
                <Text style={ov.infoText} numberOfLines={1}>{result.vehicleLabel}</Text>
              </View>
            ) : null}
          </View>

          <Text style={ov.confirmNote}>Customer has been notified their wash has started.</Text>

          <View style={ov.btnRow}>
            <Pressable
              style={ov.ghostBtn}
              onPress={() => onViewJob(result.jobId ?? result.bookingId)}
              android_ripple={{ color: Colors.white + '20' }}
            >
              <Text style={ov.ghostBtnText}>View Job</Text>
            </Pressable>
            <Pressable
              style={ov.primaryBtn}
              onPress={onReset}
              android_ripple={{ color: Colors.white + '20' }}
            >
              <Text style={ov.primaryBtnText}>Scan Another</Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ── Permission denied screen ──────────────────────────────────────────────────

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[sc.safe, { paddingTop: insets.top }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[sc.floatBack, { top: insets.top + 12 }]}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={sc.permCard}>
        <View style={sc.permIconWrap}>
          <Ionicons name="camera-outline" size={40} color={Colors.textMuted} />
        </View>
        <Text style={sc.permTitle}>Camera Access Required</Text>
        <Text style={sc.permSub}>
          Allow camera access to scan customer QR codes for check-in.
        </Text>
        <Pressable
          style={sc.permBtn}
          onPress={onRequest}
          android_ripple={{ color: Colors.accentDark, borderless: false }}
        >
          <Text style={sc.permBtnText}>Grant Camera Access</Text>
        </Pressable>
        <Pressable
          style={sc.permSecondary}
          onPress={() => Linking.openSettings()}
          android_ripple={{ color: Colors.border, borderless: false }}
        >
          <Text style={sc.permSecondaryText}>Open Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState,  setScanState]      = useState<ScanState>('scanning');
  const [result,     setResult]         = useState<CheckinResult | null>(null);
  const [errorMsg,   setErrorMsg]       = useState('');
  const [torchOn,    setTorchOn]        = useState(false);

  const slideAnim  = useRef(new Animated.Value(500)).current;
  const cooldown   = useRef(false);
  const mounted    = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // Slide result sheet in/out
  useEffect(() => {
    const show = scanState !== 'scanning';
    Animated.spring(slideAnim, {
      toValue:         show ? 0 : 500,
      useNativeDriver: true,
      bounciness:      show ? 6 : 0,
    }).start();
  }, [scanState]);

  const reset = useCallback(() => {
    setScanState('scanning');
    setResult(null);
    setErrorMsg('');
    cooldown.current = false;
  }, []);

  const handleBarcode = useCallback(async ({ data }: { data: string }) => {
    if (cooldown.current || scanState !== 'scanning') return;
    cooldown.current = true;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const bookingId = parseBookingId(data);
    if (!bookingId) {
      if (!mounted.current) return;
      setErrorMsg('Not a valid Wash Hub QR code. Ask the customer to show their booking QR.');
      setScanState('error');
      return;
    }

    setScanState('processing');

    try {
      const { data: res } = await axios.patch<CheckinResult>(
        '/api/jobs/check-in',
        { bookingId },
      );
      if (!mounted.current) return;
      setResult(res);
      setScanState('success');
    } catch (err: any) {
      if (!mounted.current) return;
      const msg = err?.response?.data?.error ?? 'Check-in failed. Please try again.';
      setErrorMsg(msg);
      setScanState('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [scanState]);

  const handleViewJob = useCallback((id: string) => {
    router.push({ pathname: '/(tabs)/jobs/[id]', params: { id } });
  }, []);

  // ── Loading permission ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return <PermissionScreen onRequest={requestPermission} />;
  }

  // ── Cutout geometry ────────────────────────────────────────────────────────
  const sideW  = (screenW - CUTOUT_SIZE) / 2;
  const topH   = (screenH - CUTOUT_SIZE) / 2;
  const bottomH = screenH - topH - CUTOUT_SIZE;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>

      {/* Full-screen camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanState === 'scanning' ? handleBarcode : undefined}
      />

      {/* Dark overlay — 4 panels around the cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top */}
        <View style={{ height: topH, backgroundColor: 'rgba(0,0,0,0.65)' }} />

        {/* Middle row */}
        <View style={{ flexDirection: 'row', height: CUTOUT_SIZE }}>
          {/* Left */}
          <View style={{ width: sideW, backgroundColor: 'rgba(0,0,0,0.65)' }} />

          {/* Cutout: corners + scan line */}
          <View style={{ width: CUTOUT_SIZE, height: CUTOUT_SIZE }}>
            {/* Corner TL */}
            <View style={[sc.corner, sc.cornerTL]} />
            {/* Corner TR */}
            <View style={[sc.corner, sc.cornerTR]} />
            {/* Corner BL */}
            <View style={[sc.corner, sc.cornerBL]} />
            {/* Corner BR */}
            <View style={[sc.corner, sc.cornerBR]} />
            {/* Scan line */}
            {scanState === 'scanning' && <ScanLine />}
          </View>

          {/* Right */}
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} />
        </View>

        {/* Bottom */}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} />
      </View>

      {/* "Point camera at QR code" hint — positioned below cutout */}
      <View
        style={{
          position: 'absolute',
          top: topH + CUTOUT_SIZE + 20,
          left: 0, right: 0,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <Text style={sc.hint}>Point camera at QR code</Text>
      </View>

      {/* ── Floating back button (top left) ── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 100,
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 20,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* ── Torch toggle (top right) ── */}
      <TouchableOpacity
        onPress={() => setTorchOn(t => !t)}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 16,
          zIndex: 100,
          backgroundColor: torchOn ? Colors.warning + 'F0' : 'rgba(255,255,255,0.9)',
          borderRadius: 20,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        }}
      >
        <Ionicons
          name={torchOn ? 'flashlight' : 'flashlight-outline'}
          size={20}
          color={torchOn ? Colors.white : Colors.textPrimary}
        />
      </TouchableOpacity>

      {/* ── Result overlay ── */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Corner brackets — 20px, 3px thick
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.white,
    borderWidth: CORNER_WIDTH,
  },
  cornerTL: { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6     },
  cornerTR: { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6    },
  cornerBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 6  },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 6 },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    opacity: 0.9,
  },

  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Floating back button (used in permission screen)
  floatBack: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // Permission screen
  permCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...cardShadow,
  },
  permTitle:   { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  permSub:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
    overflow: 'hidden',
    width: '100%',
    alignItems: 'center',
  },
  permBtnText:       { color: Colors.white, fontSize: 15, fontWeight: '700' },
  permSecondary:     { paddingVertical: 12, overflow: 'hidden', alignItems: 'center', width: '100%' },
  permSecondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
});

const ov = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    elevation: 20,
    shadowColor: Colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetSuccess:    { backgroundColor: Colors.success },
  sheetError:      { backgroundColor: Colors.error },
  sheetProcessing: { backgroundColor: Colors.textPrimary, paddingVertical: 20 },

  processingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText: { color: Colors.white, fontSize: 15, fontWeight: '600' },

  iconRow:    { alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },

  sheetTitle:  { fontSize: 22, fontWeight: '900', color: Colors.white, textAlign: 'center', marginBottom: 4 },
  sheetSub:    { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  confirmNote: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 18, lineHeight: 18 },

  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: Colors.white, fontSize: 13, fontWeight: '600', flex: 1 },

  btnRow:   { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  ghostBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
