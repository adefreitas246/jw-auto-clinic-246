// settings.tsx
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import type { PressableStateCallbackType } from "react-native";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import * as Animatable from "react-native-animatable";
import ReAnimated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Colors } from '@/constants/Colors';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING, cardShadow, borderRadius } from '@/utils/platformStyles';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type ChangeItem = { type: "New" | "Improved" | "Fixed" | string; text: string };
type WhatsNewItem = { version: string; date?: string; changes: ChangeItem[] };

// --- Remote endpoint + local fallback ---
const WHATS_NEW_URL =
  "https://jw-auto-clinic-246.onrender.com/api/support/whatsnew";

  const WHATS_NEW_FALLBACK: WhatsNewItem[] = [
    {
      version: "1.4.0",
      date: "2025-12-14",
      changes: [
        { type: "New", text: "Biometric login option added to the login screen once enabled in Settings." },
        { type: "New", text: "New bottom sheet UI for key flows like Services & Specials and Settings, replacing full-screen modals." },
        { type: "New", text: "Enhanced earnings and payment-method charts with tap-to-filter behavior and active-point display." },
        { type: "New", text: "Chart segment control now resets the detail view until you tap a new point in the current segment." },

        { type: "Improved", text: "Tablet layouts refined for Workers, Transactions, Settings, and other screens in portrait and landscape." },
        { type: "Improved", text: "Sticky headers adjusted for better full-width appearance, spacing, and elevation while scrolling." },
        { type: "Improved", text: "Floating action buttons now show correctly on Android landscape and tablet orientations." },
        { type: "Improved", text: "Bottom sheets and modals behave better with the keyboard, keeping content visible while typing." },
        { type: "Improved", text: "Login screen spacing and animations polished, including conditional biometric button display." },
        { type: "Improved", text: "Android launcher icon updated to use the correct light artwork." },

        { type: "Improved", text: "Browser password reset validation aligned with the app's strong password rules and messages." },
        { type: "Improved", text: "Transaction detail view now falls back to list data if the server returns a 404 for that transaction." },
        { type: "Improved", text: "Distance and matching logic (OSRM) improved for more consistent routing and fallback behavior." },

        { type: "Fixed", text: "Fixed bottom sheet bug where closing the keyboard left extra blank space at the bottom." },
        { type: "Fixed", text: "Fixed multiple landscape layout issues where content could be misaligned or partially hidden." },
        { type: "Fixed", text: "Fixed payment-method chart issue where the previous segment's highlighted value could remain visible." },
        { type: "Fixed", text: "Resolved custom tab bar error ('Rendered fewer hooks than expected') that could cause crashes." },
        { type: "Fixed", text: "Long service and transaction labels now wrap correctly instead of overflowing outside their cards." },
      ],
    },
    {
      version: "1.3.0",
      date: "2025-10-01",
      changes: [
        {
          type: "Improved",
          text: "Worker hourly-rate field now supports fractional values such as 9.375 per hour for more accurate pay setups.",
        },
        {
          type: "Fixed",
          text: "Fixed an issue where the email body total could differ from the receipt calculation, ensuring both now match correctly.",
        },
        {
          type: "Improved",
          text: "UI/UX updates across the Add, Workers, and Settings tabs for a cleaner and more consistent experience.",
        },
        {
          type: "Improved",
          text: "Device orientation handling updated so screens behave correctly in both portrait and landscape modes.",
        },
        {
          type: "Improved",
          text: "Additional under-the-hood changes and updates for stability and performance.",
        },
      ],
    },
    {
      version: "1.2.0",
      date: "2025-08-12",
      changes: [
        { type: "New", text: "Support form added under Settings → Report an Issue." },
        { type: "Improved", text: "Check for Updates now shows clearer messages." },
        { type: "Fixed", text: "Minor layout polish in Settings and inputs." },
      ],
    },
    {
      version: "1.1.0",
      date: "2025-08-05",
      changes: [
        { type: "New", text: "Worker and Shifts screens now refresh more reliably." },
      ],
    },
  ];


// ----- Platform helpers + design tokens --------------------------------
const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";
const isNative = isIOS || isAndroid;

const UI = {
  maxWidth: isWeb ? 1120 : 740, // wider on web
  padX: isWeb ? 24 : 18, // a bit more padding on web
  radius: Platform.select({ ios: 14, android: 10, default: 12 })!,
  colors: {
    // Light only
    bg:          Colors.background,  // Wash Hub background
    card:        Colors.white,
    border:      Colors.border,
    text:        Colors.primary,
    sub:         Colors.textSecondary,
    primary:     Colors.accent,  // teal accent
    glyphBorder: Colors.accentMuted,
  },
};

// ----- Social links (edit to your accounts) ----------------------------
const APP_NAME = String(Constants.expoConfig?.name || "Our App");
const SOCIAL = {
  website: "https://example.com",
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  twitter: "https://twitter.com/",
};

// ----- Small helpers ----------------------------------------------------
function openLink(url: string) {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    Alert.alert("Unable to open link", "Please try again later.");
  });
}

// Human-readable label for available biometrics
function getBiometricLabel(
  types: LocalAuthentication.AuthenticationType[]
): string {
  if (!types || types.length === 0) {
    return "Biometrics available";
  }
  const names: string[] = [];

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    names.push(isIOS ? "Touch ID / Fingerprint" : "Fingerprint");
  }
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    names.push(isIOS ? "Face ID" : "Face recognition");
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    names.push("Iris");
  }

  if (names.length === 0) return "Biometrics available";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.shell, { backgroundColor: UI.colors.bg }]}>
      <View
        style={[
          styles.page,
          isWeb
            ? ({
                maxWidth: "100%",
                alignSelf: "stretch",
                flex: 1,
                minHeight: 0,
              } as any)
            : null, // ← full-bleed on web
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ----- Settings row with new design icon tiles -------------------------
type RowNewProps = {
  label: string;
  value?: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconBg?: string;
  iconColor?: string;
  onPress?: () => void;
  navigates?: boolean;
  isDanger?: boolean;
  childrenRight?: React.ReactNode;
  isLast?: boolean;
};

function SettingsRow({
  label, value, subtitle, icon, iconBg, iconColor,
  onPress, navigates, isDanger, childrenRight, isLast,
}: RowNewProps) {
  const tintColor = isDanger ? Colors.error : (iconColor ?? Colors.accent);
  const bg        = isDanger ? Colors.errorBg : (iconBg ?? Colors.accentMuted);

  const content = (
    <View style={styles.rowInner}>
      <View style={[styles.rowIconCircle, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={tintColor} />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.rowLabel, isDanger && { color: Colors.error }]} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {childrenRight}
        {navigates && !isDanger ? (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textMuted}
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </View>

      {!isLast ? <View style={styles.rowDivider} /> : null}
    </View>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: Colors.accent + '20', borderless: false }}
      style={(state: PressableStateCallbackType) => [
        styles.row,
        isWeb && (state as any).hovered && ({ backgroundColor: Colors.surfaceAlt, cursor: "pointer" } as any),
        isIOS && state.pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}

// ----- Section group ---------------------------------------------------
function SettingsSection({
  title, children,
}: { title: string; children: React.ReactNode }) {
  const kids = React.Children.toArray(children);
  const decorated = kids.map((child, i) => {
    if (!React.isValidElement(child)) return child;
    if ((child as any).type === SettingsRow) {
      return React.cloneElement(child as any, { isLast: i === kids.length - 1 });
    }
    return child;
  });

  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionBody}>{decorated}</View>
    </View>
  );
}

// ----- Reusable bottom sheet -------------------------------------------
type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  keyboardOffset?: number;
};

function BottomSheet({
  visible, onClose, title, children, keyboardOffset = 0,
}: BottomSheetProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.bsWrapper}>
        <Pressable style={styles.bsBackdrop} onPress={onClose} />

        <Animatable.View
          animation="fadeInUp"
          duration={220}
          style={[
            styles.bsSheet,
            keyboardOffset ? { marginBottom: keyboardOffset } : null,
          ]}
        >
          <View style={styles.bsHandle} />
          {title ? <Text style={styles.bsTitle}>{title}</Text> : null}
          <View style={styles.bsContent}>{children}</View>
        </Animatable.View>
      </View>
    </Modal>
  );
}

// ----- Screen ------------------------------------------------------------------
export default function SettingsScreen() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone?.trim() || "");
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notificationsEnabled ?? true
  );
  const [saving, setSaving] = useState(false);
  const [showSavedAnim, setShowSavedAnim] = useState(false);

  // NEW: subtle elevation when scrolled for the sticky header
  const [headerElevated, setHeaderElevated] = useState(false);

  // --- Bottom sheets visibility ---
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [whatsNewSheetVisible, setWhatsNewSheetVisible] = useState(false);

  // --- Support form state (inside sheet) ---
  const [reportSubject, setReportSubject] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  // --- Updates state ---
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // --- What's New state (sheet content) ---
  const [whatsNew, setWhatsNew] = useState<WhatsNewItem[]>([]);
  const [loadingWhatsNew, setLoadingWhatsNew] = useState(false);
  const [whatsNewError, setWhatsNewError] = useState<string | null>(null);

  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // --- Biometrics / Security state ---
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<
    LocalAuthentication.AuthenticationType[]
  >([]);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);

  // Web layout breakpoint
  const { width } = useWindowDimensions();
  const isWideWeb = isWeb && width >= 1024;

  useEffect(() => {
    if (isWeb) return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e?.endCoordinates?.height ?? 0;
      setKeyboardOffset(height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Init biometrics from device + stored preference
  useEffect(() => {
    if (!isNative) {
      setCheckingBiometric(false);
      return;
    }

    const initBiometrics = async () => {
      try {
        const saved = await AsyncStorage.getItem("@useBiometrics");
        if (saved === "true") {
          setBiometricEnabled(true);
        }

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && enrolled) {
          setBiometricAvailable(true);
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          setBiometricTypes(types);
        } else {
          setBiometricAvailable(false);
        }
      } catch (e) {
        setBiometricAvailable(false);
      } finally {
        setCheckingBiometric(false);
      }
    };

    initBiometrics();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, email, phone, avatar, notificationsEnabled });
      Alert.alert("Saved", "Your profile has been updated.");
      setEditSheetVisible(false);
      setShowSavedAnim(true);
      setTimeout(() => setShowSavedAnim(false), 2000);
    } catch (err) {
      Alert.alert("Error", "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleSubmitReport = async () => {
    if (!reportSubject.trim() || !reportMessage.trim()) {
      Alert.alert("Missing info", "Please add a subject and a message.");
      return;
    }
    setSendingReport(true);
    try {
      const res = await fetch(
        `${"https://jw-auto-clinic-246.onrender.com"}/api/support/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
          },
          body: JSON.stringify({
            subject: reportSubject,
            message: reportMessage,
            name,
            email,
            phone,
            to: "addesylvinaus@gmail.com",
          }),
        }
      );

      const maybeJson = await res.clone().json().catch(() => null);

      if (!res.ok) {
        const serverMsg =
          (maybeJson && (maybeJson.error || maybeJson.message)) ||
          (await res.text()).slice(0, 300) ||
          "Unknown server error";
        Alert.alert("Send failed", serverMsg);
        return;
      }

      Alert.alert("Thanks!", "Your issue was sent to support.");
      setReportSubject("");
      setReportMessage("");
      setReportSheetVisible(false);
    } catch (e: any) {
      Alert.alert(
        "Network error",
        "We'll open your mail app so you can send the report manually."
      );
      const subject = encodeURIComponent(`[App Support] ${reportSubject}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${reportMessage}`
      );
      Linking.openURL(
        `mailto:addesylvinaus@gmail.com?subject=${subject}&body=${body}`
      );
      setReportSheetVisible(false);
    } finally {
      setSendingReport(false);
    }
  };

  const checkForUpdates = async () => {
    if (__DEV__ || Platform.OS === "web") {
      Alert.alert(
        "Not available here",
        "Update checks run in a production build on iOS/Android."
      );
      return;
    }

    setCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert("Update available", "Download and restart now?", [
          { text: "Later", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (e) {
                Alert.alert("Error", "Failed to apply the update.");
              }
            },
          },
        ]);
      } else {
        Alert.alert("Up to date", "You already have the latest version.");
      }
    } catch (e: any) {
      Alert.alert("Update check failed", e?.message || "Unknown error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Toggle biometric login preference (used by login screen)
  const handleToggleBiometrics = async (next: boolean) => {
    if (!isNative) return;

    if (!biometricAvailable) {
      Alert.alert(
        "Biometrics not available",
        "This device does not support biometric authentication or it is not set up."
      );
      return;
    }

    if (next) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Enable biometric login",
          fallbackLabel: isIOS ? "Use passcode" : "Use device PIN",
          cancelLabel: "Cancel",
        });

        if (result.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem("@useBiometrics", "true");
          Alert.alert(
            "Biometric login enabled",
            "You can now use Face ID, Touch ID, or your device's biometrics when logging in (where supported)."
          );
        } else {
          setBiometricEnabled(false);
        }
      } catch (e) {
        setBiometricEnabled(false);
        Alert.alert(
          "Biometric error",
          "We couldn't complete biometric authentication."
        );
      }
    } else {
      Alert.alert(
        "Turn off biometric login?",
        "You will need to log in using your email and password only.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setBiometricEnabled(true),
          },
          {
            text: "Turn Off",
            style: "destructive",
            onPress: async () => {
              setBiometricEnabled(false);
              await AsyncStorage.setItem("@useBiometrics", "false");
            },
          },
        ]
      );
    }
  };

  // --- Load release notes (with fallback) ---
  const loadWhatsNew = async () => {
    setLoadingWhatsNew(true);
    setWhatsNewError(null);
    try {
      const res = await fetch(WHATS_NEW_URL, {
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WhatsNewItem[] = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setWhatsNew(data);
    } catch {
      setWhatsNew(WHATS_NEW_FALLBACK);
      setWhatsNewError(
        "Showing local release notes. (Couldn't fetch from server.)"
      );
    } finally {
      setLoadingWhatsNew(false);
    }
  };

  useEffect(() => {
    if (whatsNewSheetVisible && whatsNew.length === 0 && !loadingWhatsNew) {
      loadWhatsNew();
    }
  }, [whatsNewSheetVisible]);

  useEffect(() => {
    if (user === null) {
    }
  }, [user]);

  // Role display
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Staff";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Shell>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[0]}
          onScroll={(e) => setHeaderElevated(e.nativeEvent.contentOffset.y > 2)}
          scrollEventThrottle={16}
        >
          {/* Sticky Header */}
          <View
            style={[
              styles.stickyHeader,
              headerElevated && styles.stickyHeaderElevated,
            ]}
          >
            <Text style={styles.largeTitle}>Settings</Text>
          </View>

          {/* ── Main content (fade in) ── */}
          <ReAnimated.View entering={FadeIn.duration(300)}>

          {/* ── Profile card ── */}
          <ReAnimated.View entering={FadeInDown.delay(0).duration(400)} style={styles.profileCardWrap}>
            <Card variant="elevated" padding={24} style={styles.profileCard}>
              <Pressable
                onPress={pickImage}
                accessibilityLabel="Edit profile picture"
                android_ripple={{ color: Colors.accent + '20', borderless: true, radius: 40 }}
                style={{ alignItems: 'center' }}
              >
                <View style={styles.profileAvatarWrap}>
                  <Avatar name={name || '?'} uri={avatar} size={72} />
                  <View style={styles.editAvatarBadge}>
                    <Ionicons name="camera-outline" size={14} color={Colors.white} />
                  </View>
                </View>
              </Pressable>

              <Text style={styles.profileName}>{name || "—"}</Text>

              <Badge
                status={user?.role === 'admin' ? 'active' : 'info'}
                label={roleLabel}
                size="sm"
                style={{ marginTop: 6 }}
              />

              <Text style={styles.profileEmail}>{email || "—"}</Text>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => setEditSheetVisible(v => !v)}
                style={{ marginTop: 12 }}
              >
                Edit Profile
              </Button>

              {showSavedAnim ? (
                <Animatable.Text
                  animation="fadeInDown"
                  duration={500}
                  style={styles.savedMessage}
                >
                  Changes saved successfully!
                </Animatable.Text>
              ) : null}
            </Card>
          </ReAnimated.View>

          {/* ── Account section ── */}
          <ReAnimated.View entering={FadeInDown.delay(80).duration(400)}>
            <SettingsSection title="Account">
              <SettingsRow
                label="Name"
                value={name || "—"}
                icon="person-outline"
                iconBg={Colors.accentMuted}
                iconColor={Colors.accent}
              />
              <SettingsRow
                label="Phone"
                value={phone?.trim() || "—"}
                icon="call-outline"
                iconBg={Colors.accentMuted}
                iconColor={Colors.accent}
              />
              <SettingsRow
                label="Email"
                value={email || "—"}
                icon="mail-outline"
                iconBg={Colors.accentMuted}
                iconColor={Colors.accent}
              />
              <SettingsRow
                label="Notifications"
                icon="notifications-outline"
                iconBg={Colors.warningBg}
                iconColor={Colors.warning}
                childrenRight={
                  <Switch
                    value={!!notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                  />
                }
              />
            </SettingsSection>
          </ReAnimated.View>

          {/* ── Security section (native only) ── */}
          {!isWeb && (
            <ReAnimated.View entering={FadeInDown.delay(120).duration(400)}>
              <SettingsSection title="Security">
                <SettingsRow
                  label="Biometric Login"
                  subtitle={
                    checkingBiometric
                      ? "Checking device security…"
                      : biometricAvailable
                      ? getBiometricLabel(biometricTypes)
                      : "Not available on this device"
                  }
                  icon="lock-closed-outline"
                  iconBg={Colors.accentMuted}
                  iconColor={Colors.accent}
                  childrenRight={
                    <Switch
                      value={biometricEnabled}
                      onValueChange={handleToggleBiometrics}
                      disabled={checkingBiometric || !biometricAvailable}
                    />
                  }
                />
              </SettingsSection>
            </ReAnimated.View>
          )}

          {/* ── Support section ── */}
          <ReAnimated.View entering={FadeInDown.delay(160).duration(400)}>
            <SettingsSection title="Support">
              <SettingsRow
                label="Report an Issue"
                icon="chatbox-ellipses-outline"
                iconBg={Colors.accentMuted}
                iconColor={Colors.accent}
                navigates
                onPress={() => setReportSheetVisible(true)}
              />
            </SettingsSection>
          </ReAnimated.View>

          {/* ── Updates section ── */}
          <ReAnimated.View entering={FadeInDown.delay(200).duration(400)}>
            <SettingsSection title="Updates">
              <SettingsRow
                label="Check for Updates"
                icon="refresh-outline"
                iconBg={Colors.successBg}
                iconColor={Colors.success}
                onPress={checkForUpdates}
                navigates={!checkingUpdate}
                value={checkingUpdate ? "Checking…" : undefined}
              />
              <SettingsRow
                label="What's New"
                icon="sparkles-outline"
                iconBg={Colors.warningBg}
                iconColor={Colors.warning}
                onPress={() => setWhatsNewSheetVisible(true)}
                navigates
              />
            </SettingsSection>
          </ReAnimated.View>

          {/* ── About section ── */}
          <ReAnimated.View entering={FadeInDown.delay(240).duration(400)}>
            <SettingsSection title="About">
              <SettingsRow
                label="Powered by"
                value="ASD Inova Technologia"
                icon="hardware-chip-outline"
                iconBg={Colors.surfaceAlt}
                iconColor={Colors.textSecondary}
              />
              <SettingsRow
                label="Version"
                value={String(Constants.expoConfig?.version || "")}
                icon="information-circle-outline"
                iconBg={Colors.surfaceAlt}
                iconColor={Colors.textSecondary}
              />
            </SettingsSection>
          </ReAnimated.View>

          {/* ── Danger Zone ── */}
          <ReAnimated.View entering={FadeInDown.delay(280).duration(400)}>
            <SettingsSection title="Danger Zone">
              <SettingsRow
                label="Log Out"
                icon="exit-outline"
                isDanger
                onPress={handleLogout}
              />
            </SettingsSection>
          </ReAnimated.View>

          </ReAnimated.View>{/* end FadeIn wrapper */}

        </ScrollView>

        {/* === EDIT PROFILE BOTTOM SHEET === */}
        <BottomSheet
          visible={editSheetVisible}
          onClose={() => setEditSheetVisible(false)}
          title="Edit Profile"
          keyboardOffset={keyboardOffset}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 460 }}
          >
            <View style={{ gap: 12 }}>
              <Text style={styles.sheetLabel}>Name</Text>
              <TextInput
                style={styles.itemInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.sheetLabel}>Phone</Text>
              <TextInput
                style={styles.itemInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="(246) 123-4567"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.sheetLabel}>Email</Text>
              <TextInput
                style={styles.itemInput}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="your@example.com"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={{ height: 16 }} />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveText}>
                  {saving ? "Saving…" : "Save Changes"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: Colors.border, marginTop: 8 },
                ]}
                onPress={() => setEditSheetVisible(false)}
              >
                <Text style={[styles.saveText, { color: Colors.textPrimary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </BottomSheet>

        {/* === REPORT ISSUE BOTTOM SHEET === */}
        <BottomSheet
          visible={reportSheetVisible}
          onClose={() => setReportSheetVisible(false)}
          title="Report an Issue"
          keyboardOffset={keyboardOffset}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
          >
            <TextInput
              style={styles.reportInput}
              placeholder="Subject"
              placeholderTextColor={Colors.textMuted}
              value={reportSubject}
              onChangeText={setReportSubject}
            />
            <TextInput
              style={[
                styles.reportInput,
                { height: 120, textAlignVertical: "top" },
              ]}
              placeholder="Describe the issue (steps to reproduce, expected vs actual, screenshots if any)"
              placeholderTextColor={Colors.textMuted}
              value={reportMessage}
              onChangeText={setReportMessage}
              multiline
            />
            <TouchableOpacity
              onPress={handleSubmitReport}
              style={[
                styles.submitReportButton,
                sendingReport && styles.buttonDisabled,
              ]}
              disabled={sendingReport}
            >
              <Text style={styles.submitReportText}>
                {sendingReport ? "Sending…" : "Send to Support"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const subject = encodeURIComponent(
                  `[App Support] ${reportSubject || ""}`
                );
                const body = encodeURIComponent(
                  `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${
                    reportMessage || ""
                  }`
                );
                Linking.openURL(
                  `mailto:addesylvinaus@gmail.com?subject=${subject}&body=${body}`
                );
                setReportSheetVisible(false);
              }}
              style={[
                styles.submitReportButton,
                { marginTop: 10, backgroundColor: Colors.accent },
              ]}
            >
              <Text style={styles.submitReportText}>Email Support</Text>
            </TouchableOpacity>
          </ScrollView>
        </BottomSheet>

        {/* === WHAT'S NEW BOTTOM SHEET === */}
        <BottomSheet
          visible={whatsNewSheetVisible}
          onClose={() => setWhatsNewSheetVisible(false)}
          title="What's New"
          keyboardOffset={keyboardOffset}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
          >
            <View style={styles.whatsNewCard}>
              <View style={styles.whatsNewHeaderRow}>
                <Text style={styles.whatsNewTitle}>Latest Features & Fixes</Text>
                <TouchableOpacity
                  onPress={loadWhatsNew}
                  disabled={loadingWhatsNew}
                >
                  <Text
                    style={[
                      styles.whatsNewRefresh,
                      loadingWhatsNew && { opacity: 0.6 },
                    ]}
                  >
                    {loadingWhatsNew ? "Refreshing…" : "Refresh"}
                  </Text>
                </TouchableOpacity>
              </View>

              {whatsNewError ? (
                <Text style={styles.whatsNewError}>{whatsNewError}</Text>
              ) : null}

              {loadingWhatsNew && whatsNew.length === 0 ? (
                <Text style={styles.whatsNewLoading}>
                  Loading release notes…
                </Text>
              ) : (
                whatsNew.map((rel) => (
                  <View
                    key={`${rel.version}-${rel.date || ""}`}
                    style={styles.whatsNewItem}
                  >
                    <View style={styles.whatsNewHeaderRow}>
                      <Text style={styles.whatsNewVersion}>
                        v{rel.version}
                      </Text>
                      {rel.date ? (
                        <Text style={styles.whatsNewDate}>{rel.date}</Text>
                      ) : null}
                    </View>
                    {rel.changes.map((c, idx) => (
                      <View key={idx} style={styles.whatsNewChangeRow}>
                        <View style={[styles.badge, getBadgeStyle(c.type)]}>
                          <Text style={styles.badgeText}>{c.type}</Text>
                        </View>
                        <Text style={styles.whatsNewChangeText}>{c.text}</Text>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </BottomSheet>
      </Shell>
    </KeyboardAvoidingView>
  );
}

function getBadgeStyle(type: string) {
  const base = { backgroundColor: Colors.accentMuted, borderColor: Colors.accentMuted };
  if (type === "New")
    return { backgroundColor: Colors.successBg, borderColor: Colors.successBg };
  if (type === "Improved")
    return { backgroundColor: Colors.accentMuted, borderColor: Colors.accentMuted };
  if (type === "Fixed")
    return { backgroundColor: Colors.warningBg, borderColor: Colors.warningBg };
  return base;
}

const styles = StyleSheet.create({
  // Shell / Page
  shell: { flex: 1 },
  page: {
    width: "100%",
    maxWidth: UI.maxWidth,
    alignSelf: "center",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 80,
  },
  container: { flexGrow: 1, paddingBottom: 100 },

  // Sticky header
  stickyHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: UI.padX,
    paddingBottom: 10,
    zIndex: 10,
    ...Platform.select({
      ios: { paddingTop: 8 },
      android: { paddingTop: 8 },
      default: { paddingTop: 12 },
    }),
  },
  stickyHeaderElevated: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  largeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  // Profile card — centered, elevated
  profileCardWrap: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  profileCard: {
    alignItems: 'center',
  },
  profileAvatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  savedMessage: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Section group
  sectionWrap: { marginTop: 8 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionBody: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },

  // Row
  row: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 13,
    color: Colors.textMuted,
    maxWidth: 160,
    textAlign: 'right',
  },
  rowDivider: {
    position: 'absolute',
    bottom: 0,
    left: 68,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // Columns (wide web)
  columns: { flexDirection: 'column' },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  col: { flex: 1 },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },

  // Bottom Sheet
  bsWrapper: { flex: 1, justifyContent: 'flex-end' },
  bsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bsSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '85%',
    ...Platform.select({
      ios:     { shadowColor: Colors.black, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
    }),
  },
  bsHandle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  bsContent: { paddingHorizontal: 20, paddingBottom: 32 },

  // Edit form
  sheetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: isIOS ? 14 : 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },

  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: { opacity: 0.6 },

  // Report form
  reportInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  submitReportButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitReportText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // What's New
  whatsNewCard: { gap: 16 },
  whatsNewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  whatsNewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  whatsNewRefresh: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },
  whatsNewError: {
    fontSize: 12,
    color: Colors.error,
    fontStyle: 'italic',
  },
  whatsNewLoading: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  whatsNewItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 8,
  },
  whatsNewVersion: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.accent,
  },
  whatsNewDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  whatsNewChangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  whatsNewChangeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
