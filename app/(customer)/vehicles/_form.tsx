// app/(customer)/vehicles/_form.tsx
// Shared form for adding and editing a vehicle.
// Not an Expo Router route (prefixed with _).
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { IS_IOS } from "@/utils/platform";
import { borderRadius, cardShadow, SCREEN_PADDING } from "@/utils/platformStyles";
import { useVehicles } from "@/hooks/useVehicles";
import {
  EMPTY_VEHICLE_FORM,
  Vehicle,
  VEHICLE_SIZES,
  VehicleForm,
  VehicleSize,
} from "@/types/vehicle";
import { ScreenHeader } from "@/components/ui";

// ─── Camera modal ─────────────────────────────────────────────────────────────
function PlateCamera({
  visible,
  onCapture,
  onClose,
}: {
  visible: boolean;
  onCapture: (base64: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
  }, [visible]);

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });
      if (photo?.base64) {
        onCapture(photo.base64);
      } else {
        Alert.alert("Error", "Could not capture image.");
      }
    } catch {
      Alert.alert("Error", "Camera capture failed.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={cam.container}>
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={cam.preview} facing="back">
              {/* Plate guide overlay */}
              <View style={cam.overlay}>
                <View style={cam.guideBox} />
                <Text style={cam.guideText}>
                  Centre the licence plate in the box
                </Text>
              </View>
            </CameraView>

            <View style={cam.toolbar}>
              <Pressable style={cam.cancelBtn} onPress={onClose}>
                <Text style={cam.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[cam.captureBtn, capturing && { opacity: 0.6 }]}
                onPress={takePicture}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <View style={cam.captureInner} />
                )}
              </Pressable>

              <View style={{ width: 64 }} />
            </View>
          </>
        ) : (
          <View style={cam.permView}>
            <Text style={cam.permText}>
              Camera permission is required to scan plates.
            </Text>
            <Pressable style={cam.permBtn} onPress={requestPermission}>
              <Text style={cam.permBtnText}>Grant Permission</Text>
            </Pressable>
            <Pressable onPress={onClose}>
              <Text style={[cam.cancelText, { marginTop: 12 }]}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
interface Props {
  mode: "add" | "edit";
}

export default function AddEditVehicleScreen({ mode }: Props) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicles, addVehicle, updateVehicle, scanPlate } = useVehicles();

  const [form, setForm] = useState<VehicleForm>(EMPTY_VEHICLE_FORM);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (mode === "edit" && id) {
      const existing = vehicles.find((v: Vehicle) => v._id === id);
      if (existing) {
        setForm({
          make: existing.make,
          model: existing.model,
          licensePlate: existing.licensePlate,
          color: existing.color,
          size: existing.size,
          notes: existing.notes,
          platePhotoUrl: existing.platePhotoUrl,
        });
      }
    }
  }, [mode, id, vehicles]);

  const set = (field: keyof VehicleForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCapture = async (base64: string) => {
    setCameraOpen(false);
    setScanning(true);
    try {
      const plate = await scanPlate(base64);
      if (plate) {
        setForm((prev) => ({
          ...prev,
          licensePlate: plate,
          platePhotoUrl: "",
        }));
      } else {
        Alert.alert(
          "No plate detected",
          "Please enter the licence plate manually.",
        );
      }
    } catch {
      Alert.alert(
        "OCR failed",
        "Could not read the plate. Please type it manually.",
      );
    } finally {
      setScanning(false);
    }
  };

  const validate = (): string | null => {
    if (!form.make.trim()) return "Make is required.";
    if (!form.model.trim()) return "Model is required.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Validation", err);
      return;
    }

    setSaving(true);
    try {
      if (mode === "add") {
        await addVehicle(form);
      } else if (id) {
        await updateVehicle(id, form);
      }
      router.back();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.error ?? "Could not save vehicle.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PlateCamera
        visible={cameraOpen}
        onCapture={handleCapture}
        onClose={() => setCameraOpen(false)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={IS_IOS ? "padding" : undefined}
      >
        <ScreenHeader
          title={mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
          backButton
        />

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(300)}>
            {/* Form card */}
            <Animated.View entering={FadeInDown.delay(80).duration(300)}>
              <View style={s.formCard}>
                <Text style={s.cardSectionLabel}>Vehicle Details</Text>

                {/* Make */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Make <Text style={s.required}>*</Text></Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Toyota"
                    placeholderTextColor={Colors.textMuted}
                    value={form.make}
                    onChangeText={set("make")}
                    autoCapitalize="words"
                  />
                </View>

                {/* Model */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Model <Text style={s.required}>*</Text></Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Corolla"
                    placeholderTextColor={Colors.textMuted}
                    value={form.model}
                    onChangeText={set("model")}
                    autoCapitalize="words"
                  />
                </View>

                {/* Colour */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Colour</Text>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Silver"
                    placeholderTextColor={Colors.textMuted}
                    value={form.color}
                    onChangeText={set("color")}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </Animated.View>

            {/* Licence plate card */}
            <Animated.View entering={FadeInDown.delay(160).duration(300)}>
              <View style={s.formCard}>
                <Text style={s.cardSectionLabel}>Licence Plate</Text>
                <View style={s.plateRow}>
                  <TextInput
                    style={[s.input, s.plateInput]}
                    placeholder="e.g. PBM 1234"
                    placeholderTextColor={Colors.textMuted}
                    value={form.licensePlate}
                    onChangeText={set("licensePlate")}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={[s.scanBtn, scanning && { opacity: 0.6 }]}
                    onPress={() => setCameraOpen(true)}
                    disabled={scanning}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    {scanning ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <>
                        <Text style={s.scanBtnIcon}>⬛</Text>
                        <Text style={s.scanBtnText}>Scan</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* Size selector card */}
            <Animated.View entering={FadeInDown.delay(240).duration(300)}>
              <View style={s.formCard}>
                <Text style={s.cardSectionLabel}>Vehicle Size</Text>
                <View style={s.sizeRow}>
                  {VEHICLE_SIZES.map((sz) => (
                    <Pressable
                      key={sz}
                      style={[s.sizePill, form.size === sz && s.sizePillActive]}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, size: sz as VehicleSize }))
                      }
                      android_ripple={{ color: Colors.accent + '20', borderless: false }}
                    >
                      <Text
                        style={[
                          s.sizePillText,
                          form.size === sz && s.sizePillTextActive,
                        ]}
                      >
                        {sz}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Notes card */}
            <Animated.View entering={FadeInDown.delay(320).duration(300)}>
              <View style={s.formCard}>
                <Text style={s.cardSectionLabel}>Notes</Text>
                <TextInput
                  style={[s.input, s.multiline]}
                  placeholder="Any special instructions or details…"
                  placeholderTextColor={Colors.textMuted}
                  value={form.notes}
                  onChangeText={set("notes")}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </Animated.View>

            {/* Save button */}
            <Animated.View entering={FadeInDown.delay(400).duration(300)}>
              <Pressable
                style={[s.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
                android_ripple={{ color: Colors.accent + '20', borderless: false }}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.saveBtnText}>
                    {mode === "add" ? "Save Vehicle" : "Save Changes"}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 100 },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },

  fieldGroup: { marginBottom: 14 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 7,
  },
  required: { color: Colors.error },

  input: {
    backgroundColor: Colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  multiline: { minHeight: 88, paddingTop: 12 },

  plateRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  plateInput: { flex: 1, marginBottom: 0, letterSpacing: 1.2, fontWeight: '700' },

  scanBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: 'row',
    gap: 4,
    minWidth: 80,
  },
  scanBtnIcon: { fontSize: 12, color: Colors.white },
  scanBtnText: { color: Colors.white, fontWeight: "700", fontSize: 13 },

  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  sizePillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  sizePillText:       { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  sizePillTextActive: { color: Colors.white, fontWeight: "700" },

  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    ...(IS_IOS
      ? { shadowColor: Colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 6 }),
  },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});

// Camera modal styles
const cam = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  preview:   { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  guideBox: {
    width: 280,
    height: 80,
    borderWidth: 2,
    borderColor: Colors.white,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  guideText: {
    color: Colors.white,
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: Colors.black,
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
  },
  cancelBtn:  { padding: 8 },
  cancelText: { color: Colors.white, fontSize: 15 },

  permView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  permText: {
    color: Colors.white,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: { color: Colors.white, fontWeight: "700" },
});
