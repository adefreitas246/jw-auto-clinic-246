// app/(tabs)/kiosk.tsx — Self-Service Kiosk
// 5-step tablet walk-in flow. Landscape lock. Keep-awake.
// Steps: 0=welcome, 1=service, 2=details, 3=payment, 4=confirm
//
// Requires:
//   npx expo install expo-keep-awake expo-screen-orientation expo-linear-gradient
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  _id: string;
  name: string;
  price: number;
  duration: number;
}

interface QueueResult {
  _id: string;
  queueNumber: number;
  position: number;
  estimatedWait: number;
  customerName: string;
  serviceLabel: string;
}

type Step = 0 | 1 | 2 | 3 | 4;

// ─── Constants ────────────────────────────────────────────────────────────────

const INACTIVITY_MS     = 60_000;
const CONFIRM_RESET_SEC = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function iconForService(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('basic') || n.includes('quick'))    return 'water-outline';
  if (n.includes('premium') || n.includes('deluxe')) return 'star-outline';
  if (n.includes('interior') || n.includes('detail'))return 'sparkles-outline';
  if (n.includes('wax') || n.includes('polish'))     return 'shield-checkmark-outline';
  if (n.includes('full') || n.includes('ultimate'))  return 'ribbon-outline';
  return 'car-sport-outline';
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  if (step === 0 || step === 4) return null;
  return (
    <View style={k.stepRow}>
      {([1, 2, 3] as const).map(s => (
        <View
          key={s}
          style={[
            k.stepDot,
            step === s && k.stepDotActive,
            step > s  && k.stepDotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({
  svc, selected, onPress,
}: {
  svc: Service; selected: boolean; onPress: () => void;
}) {
  const icon = iconForService(svc.name) as any;
  return (
    <Pressable
      style={[k.svcCard, selected && k.svcCardSel]}
      onPress={onPress}
      android_ripple={{ color: Colors.accentMuted }}
    >
      {selected && (
        <View style={k.svcCheck}>
          <Ionicons name="checkmark" size={16} color={Colors.white} />
        </View>
      )}
      <Ionicons name={icon} size={64} color={selected ? Colors.accent : Colors.textMuted} />
      <Text style={[k.svcName, selected && { color: Colors.accent }]} numberOfLines={2}>
        {svc.name}
      </Text>
      <Text style={[k.svcPrice, selected && { color: Colors.accent }]}>
        ${svc.price.toFixed(2)}
      </Text>
      <View style={k.svcDurChip}>
        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
        <Text style={k.svcDurText}>{svc.duration} min</Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function KioskScreen() {
  const insets = useSafeAreaInsets();

  const [step,       setStep]       = useState<Step>(0);
  const [services,   setServices]   = useState<Service[]>([]);
  const [svcBusy,    setSvcBusy]    = useState(true);
  const [selSvc,     setSelSvc]     = useState<Service | null>(null);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [result,     setResult]     = useState<QueueResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown,  setCountdown]  = useState(CONFIRM_RESET_SEC);

  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef    = useRef(true);
  const pulseAnim     = useRef(new Animated.Value(1)).current;

  // ── Keep awake + landscape lock ───────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync();
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    return () => {
      mountedRef.current = false;
      deactivateKeepAwake();
      if (Platform.OS !== 'web') ScreenOrientation.unlockAsync();
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, []);

  // ── Fetch services ────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get<Service[]>('/api/services/catalog')
      .then(r => setServices(r.data))
      .catch(() => {})
      .finally(() => setSvcBusy(false));
  }, []);

  // ── Welcome pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  // ── Confirm countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    setCountdown(CONFIRM_RESET_SEC);
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); if (mountedRef.current) resetToWelcome(); return CONFIRM_RESET_SEC; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetToWelcome = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    setStep(0);
    setSelSvc(null);
    setName('');
    setPhone('');
    setResult(null);
    setCountdown(CONFIRM_RESET_SEC);
  }, []);

  // ── Inactivity timer ──────────────────────────────────────────────────────
  const bumpInactivity = useCallback(() => {
    if (step === 0 || step === 4) return;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(resetToWelcome, INACTIVITY_MS);
  }, [step, resetToWelcome]);

  useEffect(() => {
    if (step >= 1 && step <= 3) bumpInactivity();
    return () => { if (inactivityRef.current) clearTimeout(inactivityRef.current); };
  }, [step]);

  // ── Navigate ──────────────────────────────────────────────────────────────
  const goTo = (s: Step) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (payMethod: 'now' | 'counter') => {
    if (!selSvc || !name.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post<QueueResult>('/api/queue', {
        customerName:  name.trim(),
        phoneNumber:   phone.trim() || undefined,
        serviceId:     selSvc._id,
        serviceName:   selSvc.name,
        paymentMethod: payMethod,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!mountedRef.current) return;
      setResult(data);
      setStep(4);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Oops!', err.response?.data?.error ?? 'Could not join queue. Please see staff.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Exit kiosk ────────────────────────────────────────────────────────────
  const handleExit = () => {
    Alert.alert(
      'Exit Kiosk',
      'Are you sure you want to exit kiosk mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit', style: 'destructive',
          onPress: () => {
            deactivateKeepAwake();
            if (Platform.OS !== 'web') ScreenOrientation.unlockAsync();
            router.back();
          },
        },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }} onTouchStart={bumpInactivity} onTouchMove={bumpInactivity}>

      {/* ════════════════════════════════════════════════
          STEP 0 — Welcome
      ════════════════════════════════════════════════ */}
      {step === 0 && (
        <Pressable style={{ flex: 1 }} onPress={() => goTo(1)}>
          <LinearGradient
            colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
            style={k.welcomeScreen}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          >
            {/* Exit Kiosk button — top right */}
            <Pressable
              style={[k.exitBtnLight, { top: insets.top + 16, right: insets.right + 16 }]}
              onPress={handleExit}
              hitSlop={12}
            >
              <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.65)" />
              <Text style={k.exitBtnLightText}>Exit Kiosk</Text>
            </Pressable>

            {/* Logo */}
            <View style={k.logoWrap}>
              <View style={k.logoCircle}>
                <Ionicons name="water" size={60} color={Colors.white} />
              </View>
              <Text style={k.logoName}>Wash Hub</Text>
            </View>

            {/* Pulsing CTA */}
            <Animated.Text style={[k.welcomeCta, { transform: [{ scale: pulseAnim }] }]}>
              Welcome! Tap to begin
            </Animated.Text>
            <Text style={k.welcomeSub}>Walk-in self-service</Text>
          </LinearGradient>
        </Pressable>
      )}

      {/* ════════════════════════════════════════════════
          STEPS 1–3 — Multi-step flow
      ════════════════════════════════════════════════ */}
      {step >= 1 && step <= 3 && (
        <View style={k.stepShell}>
          {/* Top bar */}
          <View style={[k.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable
              style={k.topBackBtn}
              onPress={() => step === 1 ? resetToWelcome() : goTo((step - 1) as Step)}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </Pressable>

            <View style={k.topBarCenter}>
              <StepIndicator step={step} />
            </View>

            <Pressable style={k.exitBtnDark} onPress={handleExit} hitSlop={8}>
              <Ionicons name="lock-closed-outline" size={13} color={Colors.textMuted} />
              <Text style={k.exitBtnDarkText}>Exit Kiosk</Text>
            </Pressable>
          </View>

          {/* ────────────────────────────────────────────
              STEP 1 — Select Service
          ──────────────────────────────────────────── */}
          {step === 1 && (
            <View style={{ flex: 1 }}>
              <Text style={k.stepHeading}>Choose your wash</Text>

              {svcBusy ? (
                <View style={k.centered}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                </View>
              ) : services.length === 0 ? (
                <View style={k.centered}>
                  <Ionicons name="alert-circle-outline" size={40} color={Colors.textMuted} />
                  <Text style={k.emptyText}>No services available. Please see staff.</Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={k.svcGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {chunk(services, 2).map((row, ri) => (
                    <View key={ri} style={k.svcRow}>
                      {row.map(svc => (
                        <ServiceCard
                          key={svc._id}
                          svc={svc}
                          selected={selSvc?._id === svc._id}
                          onPress={() => setSelSvc(svc)}
                        />
                      ))}
                      {/* Spacer if odd row */}
                      {row.length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={k.stepFooter}>
                {selSvc ? (
                  <View style={k.footerInfo}>
                    <Text style={k.footerSvcName}>{selSvc.name}</Text>
                    <Text style={k.footerSvcPrice}>${selSvc.price.toFixed(2)} · {selSvc.duration} min</Text>
                  </View>
                ) : (
                  <View style={k.footerInfo} />
                )}
                <Pressable
                  style={[k.nextBtn, !selSvc && k.nextBtnDisabled]}
                  onPress={() => selSvc && goTo(2)}
                  disabled={!selSvc}
                >
                  <Text style={k.nextBtnText}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </Pressable>
              </View>
            </View>
          )}

          {/* ────────────────────────────────────────────
              STEP 2 — Your Details
          ──────────────────────────────────────────── */}
          {step === 2 && (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <Text style={k.stepHeading}>Enter your details</Text>
              <ScrollView
                contentContainerStyle={k.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={k.inputLabel}>Your Name *</Text>
                <TextInput
                  style={k.bigInput}
                  placeholder="e.g. John Smith"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={bumpInactivity}
                />

                <Text style={k.inputLabel}>Phone Number (optional)</Text>
                <TextInput
                  style={k.bigInput}
                  placeholder="e.g. 868-555-0123"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onFocus={bumpInactivity}
                />
              </ScrollView>

              <View style={k.stepFooter}>
                <View style={k.footerInfo} />
                <Pressable
                  style={[k.nextBtn, !name.trim() && k.nextBtnDisabled]}
                  onPress={() => name.trim() && goTo(3)}
                  disabled={!name.trim()}
                >
                  <Text style={k.nextBtnText}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* ────────────────────────────────────────────
              STEP 3 — Payment Method
          ──────────────────────────────────────────── */}
          {step === 3 && (
            <View style={k.payScreen}>
              <Text style={k.stepHeading}>How would you like to pay?</Text>
              {selSvc && (
                <Text style={k.payTotal}>Total: ${selSvc.price.toFixed(2)}</Text>
              )}

              <View style={k.payRow}>
                {/* Pay Now */}
                <Pressable
                  style={[k.payCard, submitting && { opacity: 0.6 }]}
                  onPress={() => !submitting && handleSubmit('now')}
                  disabled={submitting}
                  android_ripple={{ color: Colors.accentMuted }}
                >
                  <View style={[k.payIconCircle, { backgroundColor: Colors.accentMuted }]}>
                    <Ionicons name="card-outline" size={52} color={Colors.accent} />
                  </View>
                  <Text style={k.payCardTitle}>Pay Now</Text>
                  <Text style={k.payCardSub}>
                    Card or cash at the counter{'\n'}before your service starts
                  </Text>
                  {submitting && (
                    <ActivityIndicator color={Colors.accent} style={{ marginTop: 8 }} />
                  )}
                </Pressable>

                {/* Pay at Counter */}
                <Pressable
                  style={[k.payCard, submitting && { opacity: 0.6 }]}
                  onPress={() => !submitting && handleSubmit('counter')}
                  disabled={submitting}
                  android_ripple={{ color: Colors.successBg }}
                >
                  <View style={[k.payIconCircle, { backgroundColor: Colors.successBg }]}>
                    <Ionicons name="cash-outline" size={52} color={Colors.success} />
                  </View>
                  <Text style={k.payCardTitle}>Pay at Counter</Text>
                  <Text style={k.payCardSub}>
                    Pay when your service{'\n'}is completed
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ════════════════════════════════════════════════
          STEP 4 — Confirmation
      ════════════════════════════════════════════════ */}
      {step === 4 && result && (
        <LinearGradient
          colors={[Colors.successText, Colors.success, Colors.success]}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View
            style={[
              k.confirmScreen,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
            ]}
          >
            {/* Exit button */}
            <Pressable
              style={[k.exitBtnLight, { top: insets.top + 16, right: insets.right + 16 }]}
              onPress={handleExit}
              hitSlop={12}
            >
              <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.65)" />
              <Text style={k.exitBtnLightText}>Exit Kiosk</Text>
            </Pressable>

            {/* Check circle */}
            <View style={k.confirmCheck}>
              <Ionicons name="checkmark" size={52} color={Colors.white} />
            </View>

            <Text style={k.confirmTitle}>You're in the queue!</Text>
            <Text style={k.confirmName}>
              Welcome, {result.customerName.split(' ')[0]}!
            </Text>

            {/* Stats: queue number + position + wait */}
            <View style={k.statsCard}>
              <View style={k.statBlock}>
                <Text style={k.statNum}>#{result.queueNumber}</Text>
                <Text style={k.statLabel}>Queue Number</Text>
              </View>
              <View style={k.statDivider} />
              <View style={k.statBlock}>
                <Text style={k.statNum}>{result.position}</Text>
                <Text style={k.statLabel}>
                  {result.position === 1 ? "You're first!" : 'In Line'}
                </Text>
              </View>
              <View style={k.statDivider} />
              <View style={k.statBlock}>
                <Text style={k.statNum}>
                  {result.estimatedWait > 0 ? `~${result.estimatedWait}` : 'Now'}
                </Text>
                <Text style={k.statLabel}>
                  {result.estimatedWait > 0 ? 'min wait' : 'Ready!'}
                </Text>
              </View>
            </View>

            {result.serviceLabel && (
              <Text style={k.confirmService}>{result.serviceLabel}</Text>
            )}

            {/* Countdown */}
            <Text style={k.countdownLabel}>
              Returning to start in {countdown}s…
            </Text>
            <View style={k.countdownTrack}>
              <View
                style={[
                  k.countdownFill,
                  { width: `${(countdown / CONFIRM_RESET_SEC) * 100}%` as any },
                ]}
              />
            </View>

            {/* Start Over */}
            <Pressable style={k.startOverBtn} onPress={resetToWelcome}>
              <Text style={k.startOverText}>Start Over</Text>
            </Pressable>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const k = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  emptyText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' },

  // ── Welcome ──
  welcomeScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  logoWrap:   { alignItems: 'center', gap: 14, marginBottom: 8 },
  logoCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoName:   { fontSize: 38, fontWeight: '900', color: Colors.white, letterSpacing: 1.5 },
  welcomeCta: { fontSize: 32, fontWeight: '800', color: Colors.white, textAlign: 'center' },
  welcomeSub: { fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Exit button — on dark/gradient bg
  exitBtnLight: {
    position: 'absolute', zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  exitBtnLightText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  // Exit button — on light bg (inside steps)
  exitBtnDark: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  exitBtnDarkText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  // ── Step shell ──
  stepShell: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  topBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },

  // Step dots
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.accent, width: 26, borderRadius: 5 },
  stepDotDone:   { backgroundColor: Colors.accent, opacity: 0.35 },

  stepHeading: {
    fontSize: 28, fontWeight: '800', color: Colors.textPrimary,
    paddingHorizontal: SCREEN_PADDING, paddingTop: 24, paddingBottom: 16,
  },

  // ── Service grid ──
  svcGrid: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 20 },
  svcRow:  { flexDirection: 'row', gap: 14, marginBottom: 14 },
  svcCard: {
    flex: 1, minHeight: 160,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    alignItems: 'center', justifyContent: 'center',
    padding: 20, gap: 8,
    borderWidth: 2, borderColor: Colors.transparent,
    overflow: 'hidden', position: 'relative',
    ...cardShadow,
  },
  svcCardSel:  { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  svcCheck: {
    position: 'absolute', top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  svcName:  { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  svcPrice: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  svcDurChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  svcDurText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // ── Footer ──
  stepFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING, paddingVertical: 16,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    gap: 16,
  },
  footerInfo:     { flex: 1 },
  footerSvcName:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  footerSvcPrice: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 28, paddingVertical: 15,
    overflow: 'hidden',
  },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText:     { fontSize: 17, fontWeight: '700', color: Colors.white },

  // ── Form (step 2) ──
  formContent: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8, paddingBottom: 32 },
  inputLabel: {
    fontSize: 15, fontWeight: '700', color: Colors.textSecondary,
    marginTop: 20, marginBottom: 8,
  },
  bigInput: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 20, color: Colors.textPrimary,
    borderWidth: 1.5, borderColor: Colors.border,
    ...cardShadow,
  },

  // ── Payment (step 3) ──
  payScreen: { flex: 1, justifyContent: 'center' },
  payTotal: {
    fontSize: 18, fontWeight: '700', color: Colors.textSecondary,
    paddingHorizontal: SCREEN_PADDING, marginTop: -8, marginBottom: 24,
  },
  payRow: { flexDirection: 'row', gap: 20, paddingHorizontal: SCREEN_PADDING },
  payCard: {
    flex: 1, minHeight: 220,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    alignItems: 'center', justifyContent: 'center',
    padding: 28, gap: 14,
    borderWidth: 2, borderColor: Colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  payIconCircle: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
  },
  payCardTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  payCardSub:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  // ── Confirmation (step 4) ──
  confirmScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingHorizontal: 32,
  },
  confirmCheck: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmTitle:   { fontSize: 36, fontWeight: '900', color: Colors.white },
  confirmName:    { fontSize: 20, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  confirmService: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.xl,
    paddingVertical: 20, paddingHorizontal: 28,
  },
  statBlock:   { flex: 1, alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 38, fontWeight: '900', color: Colors.white },
  statLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },

  countdownLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  countdownTrack: {
    width: 200, height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2, overflow: 'hidden',
  },
  countdownFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 2,
  },
  startOverBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 44, paddingVertical: 14,
    marginTop: 8, overflow: 'hidden',
  },
  startOverText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
