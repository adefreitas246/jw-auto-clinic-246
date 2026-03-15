// app/(tabs)/kiosk.tsx — Tablet Kiosk Mode
// Full-screen, always-on camera that auto-processes QR codes with zero
// staff interaction. Designed for a tablet mounted at the wash bay entrance.
//
// • Locks to landscape orientation (expo-screen-orientation)
// • Shows a brief toast on success (green) / error (red), then auto-resets
// • "Exit Kiosk" requires a 3-second long-press to prevent accidental exits
// • Handles double-scan via a cooldown ref
//
// Requires:
//   npx expo install expo-camera expo-screen-orientation
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Speech from 'expo-speech';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrPayload  { b: string; h: string; }
interface ToastState { visible: boolean; success: boolean; message: string; detail?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS  = 3500;
const COOLDOWN_MS        = 1500; // min ms between scans
const EXIT_HOLD_MS       = 3000; // long-press duration to exit
const HINT_MESSAGES      = [
  'Ready to scan',
  'Waiting for QR code',
  'Hold QR code in front of camera',
];

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

// ─── Toast component ──────────────────────────────────────────────────────────

function KioskToast({ toast }: { toast: ToastState }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast.visible) {
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, bounciness: 8 }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [toast.visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        ki.toast,
        toast.success ? ki.toastSuccess : ki.toastError,
        { opacity: fadeAnim, transform: [{ scale: fadeAnim }] },
      ]}
    >
      <Ionicons
        name={toast.success ? 'checkmark-circle' : 'alert-circle'}
        size={40}
        color={Colors.white}
      />
      <Text style={ki.toastTitle}>{toast.message}</Text>
      {toast.detail && <Text style={ki.toastDetail}>{toast.detail}</Text>}
    </Animated.View>
  );
}

// ─── Exit button with long-press progress ─────────────────────────────────────

function ExitButton({ onExit }: { onExit: () => void }) {
  const progress   = useRef(new Animated.Value(0)).current;
  const anim       = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    setHolding(true);
    anim.current = Animated.timing(progress, {
      toValue:        1,
      duration:       EXIT_HOLD_MS,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) onExit();
    });
  };

  const cancelHold = () => {
    anim.current?.stop();
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const arcWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      style={ki.exitBtn}
      onPressIn={startHold}
      onPressOut={cancelHold}
    >
      <View style={ki.exitProgress}>
        <Animated.View style={[ki.exitProgressFill, { width: arcWidth }]} />
      </View>
      <Ionicons name="log-out-outline" size={18} color={holding ? Colors.error : 'rgba(255,255,255,0.7)'} />
      <Text style={[ki.exitText, holding && { color: Colors.error }]}>
        {holding ? 'Exiting…' : 'Hold to Exit'}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KioskScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [toast,      setToast]          = useState<ToastState>({ visible: false, success: true, message: '' });
  const [processing, setProcessing]     = useState(false);
  const [hintIdx,    setHintIdx]        = useState(0);
  const [scanCount,  setScanCount]      = useState(0);

  const cooldownRef  = useRef(false);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Lock to landscape for tablet mounting
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      mountedRef.current = false;
      ScreenOrientation.unlockAsync();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Speech.stop();
    };
  }, []);

  // ── Rotate hint text ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setHintIdx(i => (i + 1) % HINT_MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // ── Show toast then auto-dismiss ──────────────────────────────────────────
  const showToast = useCallback((success: boolean, message: string, detail?: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, success, message, detail });

    // Voice feedback — speak the result aloud for kiosk accessibility
    Speech.stop();
    if (success) {
      const name = detail?.split('·')[0]?.trim() ?? 'Customer';
      Speech.speak(`Welcome, ${name}. Check-in successful. Please proceed to your bay.`, {
        language: 'en-US',
        rate: 0.95,
      });
    } else {
      Speech.speak('Check-in failed. Please see a staff member for assistance.', {
        language: 'en-US',
        rate: 0.9,
      });
    }

    toastTimer.current = setTimeout(() => {
      if (mountedRef.current) {
        setToast(prev => ({ ...prev, visible: false }));
        cooldownRef.current = false;
        setProcessing(false);
      }
    }, TOAST_DURATION_MS);
  }, []);

  // ── Handle QR scan ────────────────────────────────────────────────────────
  const handleBarcode = useCallback(async ({ data }: { data: string }) => {
    if (cooldownRef.current || processing) return;
    cooldownRef.current = true;
    setProcessing(true);

    const parsed = parseQrData(data);
    if (!parsed) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(false, 'Invalid QR', 'Not a Wash Hub booking code');
      return;
    }

    try {
      const { data: checkin } = await axios.post(
        `/api/bookings/${parsed.b}/checkin`,
        { h: parsed.h }
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!mountedRef.current) return;
      setScanCount(c => c + 1);
      showToast(
        true,
        `✓ Checked In`,
        `${checkin.customerName}  ·  ${checkin.vehicleLabel || checkin.serviceLabel}`
      );
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!mountedRef.current) return;
      const msg = err.response?.data?.error ?? 'Check-in failed';
      showToast(false, 'Check-In Failed', msg);
    }
  }, [processing, showToast]);

  const handleExit = useCallback(() => {
    ScreenOrientation.unlockAsync();
    router.back();
  }, []);

  // ── Permission loading ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={ki.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={[ki.centered, { backgroundColor: Colors.black }]}>
        <Ionicons name="camera-outline" size={56} color={Colors.textSecondary} />
        <Text style={[ki.hint, { color: Colors.white, fontSize: 18, marginBottom: 24 }]}>
          Camera permission required for kiosk mode
        </Text>
        <Pressable style={ki.permBtn} onPress={requestPermission}>
          <Text style={ki.permBtnText}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.black }}>
      {/* ── Full-screen camera ── */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={!processing ? handleBarcode : undefined}
      />

      {/* ── Overlay ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top status bar */}
        <SafeAreaView edges={['top', 'left', 'right']} style={ki.topBar}>
          <View style={ki.topBarInner}>
            {/* Branding */}
            <View style={ki.brandRow}>
              <View style={ki.brandDot} />
              <Text style={ki.brandText}>Wash Hub  ·  Kiosk</Text>
            </View>

            {/* Stats */}
            <View style={ki.statsRow}>
              <Text style={ki.statLabel}>Checked In Today</Text>
              <Text style={ki.statValue}>{scanCount}</Text>
            </View>

            {/* Exit */}
            <ExitButton onExit={handleExit} />
          </View>
        </SafeAreaView>

        {/* Centre viewfinder */}
        <View style={ki.frameWrap} pointerEvents="none">
          <View style={ki.frame}>
            <View style={[ki.corner, ki.cTL]} />
            <View style={[ki.corner, ki.cTR]} />
            <View style={[ki.corner, ki.cBL]} />
            <View style={[ki.corner, ki.cBR]} />
            {/* Processing spinner inside frame */}
            {processing && (
              <View style={ki.frameSpinner}>
                <ActivityIndicator color={Colors.white} size="large" />
              </View>
            )}
          </View>

          {/* Hint */}
          {!processing && (
            <Text style={ki.hint}>{HINT_MESSAGES[hintIdx]}</Text>
          )}
        </View>

        {/* Bottom pad */}
        <View style={ki.bottomPad} pointerEvents="none">
          <Text style={ki.bottomText}>
            Customers: open the Wash Hub app and show your booking QR code
          </Text>
        </View>
      </View>

      {/* ── Toast overlay ── */}
      <KioskToast toast={toast} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ki = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Top bar
  topBar:      { backgroundColor: 'rgba(0,0,0,0.6)' },
  topBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  brandText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  statsRow:  { alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: Colors.white, fontSize: 22, fontWeight: '900' },

  // Exit button
  exitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, overflow: 'hidden',
  },
  exitProgress:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'transparent' },
  exitProgressFill: { height: '100%', backgroundColor: Colors.error },
  exitText:         { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },

  // Viewfinder frame
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: {
    width: 280, height: 280,
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  corner:   { position: 'absolute', width: 36, height: 36, borderColor: Colors.white, borderWidth: 4 },
  cTL: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius:    10 },
  cTR: { top: 0, right: 0, borderLeftWidth:  0, borderBottomWidth: 0, borderTopRightRadius:   10 },
  cBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius:  10 },
  cBR: { bottom: 0, right: 0, borderLeftWidth:  0, borderTopWidth: 0, borderBottomRightRadius: 10 },
  frameSpinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hint: {
    color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center',
    maxWidth: 280,
  },

  // Bottom
  bottomPad: { paddingBottom: 28, alignItems: 'center' },
  bottomText:{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },

  // Toast
  toast: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: [{ translateX: -160 }, { translateY: -90 }],
    width: 320, minHeight: 180,
    borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 10,
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 20 },
    }),
  },
  toastSuccess: { backgroundColor: Colors.success },
  toastError:   { backgroundColor: Colors.error },
  toastTitle:   { fontSize: 22, fontWeight: '900', color: Colors.white, textAlign: 'center' },
  toastDetail:  { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },

  // Permission
  permBtn:     { backgroundColor: Colors.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  permBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
