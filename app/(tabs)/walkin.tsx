// app/(tabs)/walkin.tsx — Self-Service Walk-in Kiosk
// Tablet-optimized, 5-screen flow (idle + 4 steps):
//   0 — Idle/welcome (tap anywhere to start)
//   1 — Choose service or package
//   2 — Enter name + phone
//   3 — Payment preference (Pay Now / Pay After)
//   4 — Confirmation: queue number, position, wait + auto-reset countdown
//
// Requires:
//   npx expo install expo-keep-awake
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceDoc {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
}

interface PackageDoc {
  _id: string;
  name: string;
  description: string;
  price: number | null;
  serviceIds: { name: string; price: number; duration: number }[];
}

interface CatalogItem {
  id: string;
  itemType: "package" | "service";
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
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

const INACTIVITY_MS = 30_000;
const CONFIRM_RESET_SEC = 30;

const STEP_LABELS: Record<number, string> = {
  1: "Choose Service",
  2: "Your Details",
  3: "Payment",
  4: "You're In!",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  if (step === 0 || step === 4) return null;
  return (
    <View style={k.dots}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            k.dot,
            step === s ? k.dotActive : step > s ? k.dotDone : k.dotIdle,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Service / package tile ───────────────────────────────────────────────────

function CatalogTile({
  item,
  selected,
  onPress,
}: {
  item: CatalogItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        k.tile,
        selected && k.tileSelected,
        pressed && { opacity: 0.88 },
      ]}
      onPress={onPress}
      android_ripple={{ color: "#e8dff8" }}
    >
      {item.itemType === "package" && (
        <View style={k.bundleBadge}>
          <Text style={k.bundleText}>BUNDLE</Text>
        </View>
      )}
      <Text
        style={[k.tileName, selected && k.tileNameSelected]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {!!item.description && (
        <Text style={k.tileDesc} numberOfLines={1}>
          {item.description}
        </Text>
      )}
      <View style={k.tilePriceRow}>
        <Text style={[k.tilePrice, selected && { color: "#6a0dad" }]}>
          ${item.price.toFixed(2)}
        </Text>
        <View style={k.tileDurChip}>
          <Ionicons name="time-outline" size={12} color="#888" />
          <Text style={k.tileDur}>{item.durationMinutes} min</Text>
        </View>
      </View>
      {selected && (
        <View style={k.tileCheck}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WalkinKioskScreen() {
  const { user } = useAuth();

  // ── Catalog ──────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(true);

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(0);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "counter">("counter");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QueueResult | null>(null);

  // ── Inactivity + countdown ────────────────────────────────────────────────
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = useState(CONFIRM_RESET_SEC);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Keep awake + orientation ──────────────────────────────────────────────
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    ScreenOrientation.unlockAsync(); // allow portrait + landscape
    return () => {
      KeepAwake.deactivateKeepAwake();
    };
  }, []);

  // ── Idle pulse ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  // ── Fetch catalog ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [pkgRes, svcRes] = await Promise.all([
          axios.get<PackageDoc[]>("/api/packages/catalog"),
          axios.get<ServiceDoc[]>("/api/services/catalog"),
        ]);

        const pkgItems: CatalogItem[] = pkgRes.data.map((p) => ({
          id: p._id,
          itemType: "package",
          name: p.name,
          description: p.description || "",
          price: p.price ?? p.serviceIds.reduce((s, sv) => s + sv.price, 0),
          durationMinutes:
            p.serviceIds.reduce((s, sv) => s + sv.duration, 0) || 30,
        }));

        const svcItems: CatalogItem[] = svcRes.data.map((s) => ({
          id: s._id,
          itemType: "service",
          name: s.name,
          description: s.description || s.category || "",
          price: s.price,
          durationMinutes: s.duration,
        }));

        setCatalog([...pkgItems, ...svcItems]);
      } catch {
        // Silently fail — user sees empty catalog with retry option
      } finally {
        setCatalogBusy(false);
      }
    })();
  }, []);

  // ── Reset to idle ─────────────────────────────────────────────────────────
  const resetToIdle = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    setStep(0);
    setSelected(null);
    setName("");
    setPhone("");
    setPayMethod("counter");
    setResult(null);
    setCountdown(CONFIRM_RESET_SEC);
  }, []);

  // ── Inactivity timer (active on steps 1-3) ────────────────────────────────
  const bumpTimer = useCallback(() => {
    if (step === 0 || step === 4) return;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(resetToIdle, INACTIVITY_MS);
  }, [step, resetToIdle]);

  useEffect(() => {
    if (step >= 1 && step <= 3) {
      bumpTimer(); // start timer on entering these steps
    }
    return () => {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [step]);

  // ── Confirmation countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    setCountdown(CONFIRM_RESET_SEC);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          resetToIdle();
          return CONFIRM_RESET_SEC;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step, resetToIdle]);

  // ── Navigate steps ────────────────────────────────────────────────────────
  const goTo = useCallback((s: Step) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s);
  }, []);

  // ── Submit queue entry ────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selected || !name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        customerName: name.trim(),
        phoneNumber: phone.trim(),
        serviceLabel: selected.name,
        price: selected.price,
        durationMinutes: selected.durationMinutes,
        paymentMethod: payMethod,
        ...(selected.itemType === "package"
          ? { packageId: selected.id }
          : { serviceId: selected.id }),
      };
      const { data } = await axios.post<QueueResult>("/api/queue", body);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(data);
      setStep(4);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Oops!",
        err.response?.data?.error ??
          "Could not add to queue. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [selected, name, phone, payMethod]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }} onTouchStart={bumpTimer} onTouchMove={bumpTimer}>
      {/* ── Step 0: Idle / welcome screen ── */}
      {step === 0 && (
        <Pressable style={{ flex: 1 }} onPress={() => goTo(1)}>
          <LinearGradient
            colors={["#3d007a", "#6a0dad", "#9c3fe0"]}
            style={k.idleScreen}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          >
            <SafeAreaView style={k.idleInner}>
              {/* Back button (admin can escape kiosk mode) */}
              <Pressable
                style={k.idleBack}
                onPress={() => router.back()}
                hitSlop={12}
              >
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color="rgba(255,255,255,0.5)"
                />
              </Pressable>

              {/* Main icon */}
              <Animated.View
                style={[k.idleIconWrap, { transform: [{ scale: pulseAnim }] }]}
              >
                <Ionicons name="car-sport-outline" size={72} color="#fff" />
              </Animated.View>

              <Text style={k.idleTitle}>Walk-in Service</Text>
              <Text style={k.idleSub}>
                Join the queue and we'll get you sorted
              </Text>

              {catalogBusy ? (
                <ActivityIndicator
                  color="rgba(255,255,255,0.7)"
                  style={{ marginTop: 40 }}
                />
              ) : (
                <View style={k.idleTapHint}>
                  <Ionicons
                    name="hand-left-outline"
                    size={22}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text style={k.idleTapText}>TAP ANYWHERE TO START</Text>
                </View>
              )}
            </SafeAreaView>
          </LinearGradient>
        </Pressable>
      )}

      {/* ── Steps 1–3: Multi-step flow ── */}
      {step >= 1 && step <= 3 && (
        <SafeAreaView style={k.safe} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={k.header}>
            <Pressable
              style={k.headerBack}
              onPress={() =>
                step === 1 ? resetToIdle() : goTo((step - 1) as Step)
              }
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={22} color="#1f1f1f" />
            </Pressable>
            <View style={k.headerCenter}>
              <StepDots step={step} />
              <Text style={k.headerTitle}>{STEP_LABELS[step]}</Text>
            </View>
            <Pressable style={k.headerX} onPress={resetToIdle} hitSlop={10}>
              <Ionicons name="close" size={22} color="#888" />
            </Pressable>
          </View>

          {/* ── Step 1: Service selection ── */}
          {step === 1 && (
            <ScrollView
              contentContainerStyle={k.gridContent}
              showsVerticalScrollIndicator={false}
            >
              {catalogBusy && (
                <View style={k.centered}>
                  <ActivityIndicator size="large" color="#6a0dad" />
                </View>
              )}
              {!catalogBusy && catalog.length === 0 && (
                <View style={k.centered}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={40}
                    color="#ccc"
                  />
                  <Text style={k.emptyText}>
                    No services available. Please see staff.
                  </Text>
                </View>
              )}
              {!catalogBusy && catalog.length > 0 && (
                <>
                  {/* Packages first */}
                  {catalog.filter((c) => c.itemType === "package").length >
                    0 && (
                    <>
                      <Text style={k.gridSection}>Packages</Text>
                      <View style={k.grid}>
                        {catalog
                          .filter((c) => c.itemType === "package")
                          .map((item) => (
                            <CatalogTile
                              key={item.id}
                              item={item}
                              selected={selected?.id === item.id}
                              onPress={() => setSelected(item)}
                            />
                          ))}
                      </View>
                    </>
                  )}
                  {/* Services */}
                  {catalog.filter((c) => c.itemType === "service").length >
                    0 && (
                    <>
                      <Text style={k.gridSection}>Individual Services</Text>
                      <View style={k.grid}>
                        {catalog
                          .filter((c) => c.itemType === "service")
                          .map((item) => (
                            <CatalogTile
                              key={item.id}
                              item={item}
                              selected={selected?.id === item.id}
                              onPress={() => setSelected(item)}
                            />
                          ))}
                      </View>
                    </>
                  )}

                  {/* Selected summary + continue */}
                  {selected && (
                    <View style={k.selectedSummary}>
                      <View style={{ flex: 1 }}>
                        <Text style={k.selectedName}>{selected.name}</Text>
                        <Text style={k.selectedPrice}>
                          ${selected.price.toFixed(2)} ·{" "}
                          {selected.durationMinutes} min
                        </Text>
                      </View>
                      <Pressable style={k.continueBtn} onPress={() => goTo(2)}>
                        <Text style={k.continueBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}

          {/* ── Step 2: Customer details ── */}
          {step === 2 && (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <ScrollView
                contentContainerStyle={k.formContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Selected service recap */}
                {selected && (
                  <View style={k.serviceRecap}>
                    <Ionicons name="layers-outline" size={16} color="#6a0dad" />
                    <Text style={k.serviceRecapText}>
                      {selected.name} · ${selected.price.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Name field */}
                <Text style={k.inputLabel}>Full Name *</Text>
                <TextInput
                  style={k.input}
                  placeholder="e.g. John Smith"
                  placeholderTextColor="#bbb"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={bumpTimer}
                />

                {/* Phone field */}
                <Text style={k.inputLabel}>
                  Phone Number (optional — for updates)
                </Text>
                <TextInput
                  style={k.input}
                  placeholder="e.g. 868-555-0123"
                  placeholderTextColor="#bbb"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onFocus={bumpTimer}
                />

                <Pressable
                  style={({ pressed }) => [
                    k.continueBtn,
                    k.continueBtnFull,
                    !name.trim() && k.continueBtnDisabled,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={() => (name.trim() ? goTo(3) : null)}
                  disabled={!name.trim()}
                >
                  <Text style={k.continueBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ── Step 3: Payment preference ── */}
          {step === 3 && (
            <View style={k.paymentScreen}>
              {selected && (
                <Text style={k.paymentTotal}>
                  Total: ${selected.price.toFixed(2)}
                </Text>
              )}

              <View style={k.paymentRow}>
                {/* Pay Now */}
                <Pressable
                  style={[k.payCard, payMethod === "cash" && k.payCardSelected]}
                  onPress={() => setPayMethod("cash")}
                >
                  <View
                    style={[
                      k.payIconWrap,
                      payMethod === "cash" && k.payIconWrapSelected,
                    ]}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={36}
                      color={payMethod === "cash" ? "#fff" : "#6a0dad"}
                    />
                  </View>
                  <Text
                    style={[
                      k.payCardTitle,
                      payMethod === "cash" && k.payCardTitleSelected,
                    ]}
                  >
                    Pay Now
                  </Text>
                  <Text style={k.payCardSub}>
                    Cash at the counter{"\n"}before your service starts
                  </Text>
                  {payMethod === "cash" && (
                    <View style={k.payCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>

                {/* Pay After */}
                <Pressable
                  style={[
                    k.payCard,
                    payMethod === "counter" && k.payCardSelected,
                  ]}
                  onPress={() => setPayMethod("counter")}
                >
                  <View
                    style={[
                      k.payIconWrap,
                      payMethod === "counter" && k.payIconWrapSelected,
                    ]}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={36}
                      color={payMethod === "counter" ? "#fff" : "#6a0dad"}
                    />
                  </View>
                  <Text
                    style={[
                      k.payCardTitle,
                      payMethod === "counter" && k.payCardTitleSelected,
                    ]}
                  >
                    Pay After
                  </Text>
                  <Text style={k.payCardSub}>
                    Pay when your service{"\n"}is completed
                  </Text>
                  {payMethod === "counter" && (
                    <View style={k.payCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Confirm CTA */}
              <Pressable
                style={({ pressed }) => [
                  k.confirmBtn,
                  pressed && { opacity: 0.88 },
                  submitting && { opacity: 0.6 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={k.confirmBtnText}>Join Queue</Text>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#fff"
                    />
                  </>
                )}
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      )}

      {/* ── Step 4: Confirmation ── */}
      {step === 4 && result && (
        <LinearGradient
          colors={["#1a5c2e", "#2e7d32", "#43a047"]}
          style={k.confirmScreen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={k.confirmInner}>
            {/* Check icon */}
            <View style={k.confirmCheck}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>

            <Text style={k.confirmTitle}>You're in the queue!</Text>
            <Text style={k.confirmName}>
              Welcome, {result.customerName.split(" ")[0]}!
            </Text>

            {/* Queue number */}
            <View style={k.queueNumWrap}>
              <Text style={k.queueNumLabel}>Queue Number</Text>
              <Text style={k.queueNum}>#{result.queueNumber}</Text>
            </View>

            {/* Stats row */}
            <View style={k.statsRow}>
              <View style={k.statCard}>
                <Text style={k.statValue}>{result.position}</Text>
                <Text style={k.statLabel}>
                  {result.position === 1 ? "You're first!" : "In line"}
                </Text>
              </View>
              <View style={k.statDivider} />
              <View style={k.statCard}>
                <Text style={k.statValue}>
                  {result.estimatedWait > 0
                    ? `~${result.estimatedWait}`
                    : "Now"}
                </Text>
                <Text style={k.statLabel}>
                  {result.estimatedWait > 0 ? "min wait" : "Ready!"}
                </Text>
              </View>
            </View>

            <Text style={k.serviceConfirmText}>{result.serviceLabel}</Text>

            {/* Countdown */}
            <Text style={k.countdown}>Resetting in {countdown}s</Text>
            <View style={k.countdownTrack}>
              <View
                style={[
                  k.countdownFill,
                  { width: `${(countdown / CONFIRM_RESET_SEC) * 100}%` as any },
                ]}
              />
            </View>

            {/* Done button */}
            <Pressable style={k.doneBtn} onPress={resetToIdle}>
              <Text style={k.doneBtnText}>Done</Text>
            </Pressable>
          </SafeAreaView>
        </LinearGradient>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHADOW =
  Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 3 },
  }) ?? {};

const k = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f7fb" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyText: { fontSize: 16, color: "#aaa", textAlign: "center" },

  // ── Idle screen ──
  idleScreen: { flex: 1 },
  idleInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  idleBack: { position: "absolute", top: 52, left: 24 },
  idleIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  idleTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 10,
  },
  idleSub: {
    fontSize: 20,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginBottom: 60,
  },
  idleTapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 40,
  },
  idleTapText: {
    fontSize: 20,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 2,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerX: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1f1f1f" },

  // Step dots
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#6a0dad", width: 20 },
  dotDone: { backgroundColor: "#6a0dad", opacity: 0.4 },
  dotIdle: { backgroundColor: "#ddd" },

  // ── Step 1: Grid ──
  gridContent: { padding: 20, paddingBottom: 120 },
  gridSection: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  tile: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
    minHeight: 130,
    ...SHADOW,
  },
  tileSelected: { borderColor: "#6a0dad", backgroundColor: "#faf5ff" },
  bundleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#6a0dad",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  bundleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.8,
  },
  tileName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 4,
  },
  tileNameSelected: { color: "#6a0dad" },
  tileDesc: { fontSize: 13, color: "#888", marginBottom: 10, lineHeight: 18 },
  tilePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto" as any,
  },
  tilePrice: { fontSize: 20, fontWeight: "900", color: "#1f1f1f" },
  tileDurChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tileDur: { fontSize: 11, color: "#888", fontWeight: "600" },
  tileCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#6a0dad",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedSummary: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    ...SHADOW,
  },
  selectedName: { fontSize: 15, fontWeight: "700", color: "#1f1f1f" },
  selectedPrice: { fontSize: 13, color: "#888", marginTop: 2 },

  // ── Continue / action buttons ──
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6a0dad",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  continueBtnFull: { marginTop: 32, justifyContent: "center" },
  continueBtnDisabled: { backgroundColor: "#ccc" },
  continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // ── Step 2: Form ──
  formContent: { padding: 24, paddingBottom: 40 },
  serviceRecap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3eafd",
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  serviceRecapText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6a0dad",
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    fontSize: 18,
    color: "#1f1f1f",
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    ...SHADOW,
  },

  // ── Step 3: Payment ──
  paymentScreen: { flex: 1, padding: 24, justifyContent: "center", gap: 24 },
  paymentTotal: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f1f1f",
    textAlign: "center",
  },
  paymentRow: { flexDirection: "row", gap: 16 },
  payCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "transparent",
    ...SHADOW,
  },
  payCardSelected: { borderColor: "#6a0dad", backgroundColor: "#faf5ff" },
  payIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3eafd",
    alignItems: "center",
    justifyContent: "center",
  },
  payIconWrapSelected: { backgroundColor: "#6a0dad" },
  payCardTitle: { fontSize: 20, fontWeight: "800", color: "#1f1f1f" },
  payCardTitleSelected: { color: "#6a0dad" },
  payCardSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  payCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#6a0dad",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#6a0dad",
    borderRadius: 16,
    paddingVertical: 18,
    ...SHADOW,
  },
  confirmBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },

  // ── Step 4: Confirmation ──
  confirmScreen: { flex: 1 },
  confirmInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  confirmCheck: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  confirmTitle: { fontSize: 36, fontWeight: "900", color: "#fff" },
  confirmName: {
    fontSize: 20,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 8,
  },
  queueNumWrap: { alignItems: "center", marginVertical: 8 },
  queueNumLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  queueNum: { fontSize: 80, fontWeight: "900", color: "#fff", lineHeight: 90 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 20,
    gap: 0,
    width: "100%",
    maxWidth: 400,
  },
  statCard: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  statValue: { fontSize: 32, fontWeight: "900", color: "#fff" },
  statLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  serviceConfirmText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
  },
  countdown: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 16 },
  countdownTrack: {
    width: 200,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  countdownFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 2,
  },
  doneBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 16,
    marginTop: 12,
  },
  doneBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
