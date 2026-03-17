import CountryPickerCompat, { Country, CountryCode } from "@/components/CountryPickerCompat";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView, Modal, Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import "react-native-gesture-handler";
import { Swipeable, gestureHandlerRootHOC } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ReAnimated, { FadeInDown } from "react-native-reanimated";
import { Colors } from '@/constants/Colors';
import { IS_IOS, IS_ANDROID } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

type Role = "admin" | "staff";

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: Role | string;
  hourlyRate?: number;
  clockedIn: boolean;
}

interface Shift {
  _id: string;
  worker: string;
  date: string;        // "YYYY-MM-DD"
  clockIn: string;     // "01:23:45 PM"
  clockOut?: string;   // undefined if active
  status: "Active" | "Completed";
  lunchStart?: string;
  lunchEnd?: string;
}

function EmployeesScreen() {
  // ----- Platform helpers + design tokens --------------------------------
  const isWeb = Platform.OS === "web";
  const isIOS = (Platform.OS as string) === "ios";
  const isAndroid = Platform.OS === "android";

  const UI = {
    maxWidth: 740,
    padX: 18,
    radius: Platform.select({ ios: 14, android: 10, default: 12 })!,
    colors: {
      bg:          Colors.background,
      card:        Colors.white,
      border:      Colors.border,
      text:        Colors.primary,
      sub:         Colors.textSecondary,
      primary:     Colors.accent,
      glyphBorder: Colors.accentMuted,
    },
  };

  // sticky header elevation on scroll
  const [headerElevated, setHeaderElevated] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showEvent = isIOS ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = isIOS ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);



  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const smallestSide = Math.min(width, height);

  const isPhone = !isWeb && smallestSide < 600;
  const isTablet = !isWeb && smallestSide >= 600;

  // Only phones use the inline sticky header row hack.
  const useInlineStickyHeader = isPhone;

  // --- Web responsiveness ---
  const BREAKPOINT_TABLE = 900;
  const isWebCards = isWeb && width < BREAKPOINT_TABLE;
  const isWebTable = isWeb && !isWebCards;

  // Responsive columns
  const columns = useMemo(() => {
    if (isWebTable) return 1;
    if (isPhone) return 1;
    if (!isWeb && isTablet) {
      return width >= 700 ? 2 : 1;
    }
    return width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  }, [isWebTable, isPhone, isTablet, isWeb, width]);

  const isWide = columns > 1;


  // ---------- Data ----------
  const [workers, setEmployees] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tick, setTick] = useState(0);

  // ---------- Add Form ----------
  const [addVisible, setAddVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [openRole, setOpenRole] = useState(false);

  // touched flags for inline validation
  const [tName, setTName] = useState(false);
  const [tEmail, setTEmail] = useState(false);
  const [tPhone, setTPhone] = useState(false);
  const [tRole, setTRole] = useState(false);
  const [tRate, setTRate] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [hourlyRateError, setHourlyRateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Country/phone formatting
  const [countryCode, setCountryCode] = useState<CountryCode>("BB");
  const [callingCode, setCallingCode] = useState("1");
  const [country, setCountry] = useState<Country | null>(null);

  // ---------- Filters/Search ----------
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [openRoleFilter, setOpenRoleFilter] = useState(false);

  // ---------- UI States ----------
  const [clockingIds, setClockingIds] = useState<Set<string>>(new Set());
  const [lunchingIds, setLunchingIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------- Filter chip state ----------
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "offduty" | "onbreak">("all");

  // ---------- Helpers ----------
  const api = "https://jw-auto-clinic-246.onrender.com";

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/workers`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      // console.error("Error fetching workers", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/shifts`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      // console.error("Error fetching shifts", err);
    }
  }, [user]);

  useEffect(() => {
    fetchEmployees();
    fetchShifts();

    const interval = setInterval(() => {
      fetchEmployees();
      fetchShifts();
      setTick((t) => t + 1);
    }, 5000);

    const sec = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      clearInterval(interval);
      clearInterval(sec);
    };
  }, [fetchEmployees, fetchShifts]);

  // ---------- Validation ----------
  const validateName = (text: string) => {
    const trimmed = text.replace(/\s+/g, " ").trim();
    setName(trimmed);
    const basic = /^[a-zA-Z\s.'-]{2,}$/.test(trimmed);
    const parts = trimmed.split(" ");
    const twoWords = parts.length >= 2 && parts.every((p) => p.length >= 2);
    setNameError(basic && twoWords ? "" : "Enter full name (e.g. Jane Smith).");
  };

  const validateEmail = (text: string) => {
    setEmail(text);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
    setEmailError(ok ? "" : "Enter a valid email address.");
  };

  const formatPhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const validatePhone = (text: string) => {
    const digits = text.replace(/\D/g, "");
    const formatted = formatPhoneNumber(digits);
    setPhone(formatted);
    const full = `${callingCode}-${formatted}`;
    const ok = new RegExp(`^${callingCode}-\\d{3}-\\d{3}-\\d{4}$`).test(full);
    setPhoneError(ok ? "" : `Invalid format. Ex: ${callingCode}-XXX-XXX-XXXX`);
  };

  const onSelectCountry = (c: Country) => {
    setCountryCode(c.cca2);
    setCallingCode(c.callingCode?.[0] || "");
    setCountry(c);
    setPhone("");
    setPhoneError("");
  };

  const validateRole = (value: Role | null) => {
    setRole(value);
    if (tRole) setRoleError(value === "admin" || value === "staff" ? "" : "Please select a role.");
  };

  const sanitiseRate = (val: string) => {
    let v = val.replace(/[^\d.]/g, "");
    const dot = v.indexOf(".");
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
    v = v.replace(/^(\d{0,3})(\d*)$/, (_m, a, b) => a + b);
    v = v.replace(/^(\d{1,3})(?:\.(\d{0,3}))?.*$/, (_m, a, b) => (b !== undefined ? `${a}.${b}` : a));
    setHourlyRate(v);
    if (tRate) setHourlyRateError(v.length ? "" : "Hourly rate is required for staff.");
  };

  // ---------- Derived ----------
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!map.has(s.worker)) map.set(s.worker, []);
      map.get(s.worker)!.push(s);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => +shiftStart(b) - +shiftStart(a));
      map.set(k, arr);
    }
    return map;
  }, [shifts, tick]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workers.filter((e) => {
      const matchesRole = roleFilter === "all" ? true : e.role === roleFilter;
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone || "").toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [workers, roleFilter, searchQuery]);

  // Filter chips derived filter
  const chipFilteredEmployees = useMemo(() => {
    if (activeFilter === "all") return filteredEmployees;
    if (activeFilter === "active") return filteredEmployees.filter(e => e.clockedIn);
    if (activeFilter === "offduty") return filteredEmployees.filter(e => !e.clockedIn);
    if (activeFilter === "onbreak") {
      return filteredEmployees.filter(e => {
        const empShifts = shiftsByEmployee.get(e.name) || [];
        const last = empShifts[0];
        return last && !last.clockOut && last.lunchStart && !last.lunchEnd;
      });
    }
    return filteredEmployees;
  }, [filteredEmployees, activeFilter, shiftsByEmployee]);

  // First two "rows" are not workers
  const dataCards = useMemo(() => {
    if (useInlineStickyHeader) {
      return [
        { __type: "stickyHeader" } as any,
        { __type: "mobileHeader" } as any,
        ...chipFilteredEmployees,
      ];
    }
    return chipFilteredEmployees;
  }, [chipFilteredEmployees, useInlineStickyHeader]);


  // ---------- Shift time helpers ----------
  function parseDateTime(dateISO: string, time12h: string) {
    const [time, ampm] = time12h.split(" ");
    const [hh, mm, ss] = time.split(":").map((n) => parseInt(n, 10));
    let H = hh % 12;
    if (ampm?.toUpperCase() === "PM") H += 12;
    const pad = (n: number) => String(n).padStart(2, "0");
    return new Date(`${dateISO}T${pad(H)}:${pad(mm)}:${pad(ss)}`);
  }
  function shiftStart(s: Shift) {
    return parseDateTime(s.date, s.clockIn);
  }
  function shiftEnd(s: Shift) {
    return s.clockOut ? parseDateTime(s.date, s.clockOut) : new Date();
  }
  function formatDuration(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  // ---------- Actions ----------
  const refetchAll = async () => {
    await Promise.all([fetchEmployees(), fetchShifts()]);
  };

  const handleAddEmployee = async () => {
    setSubmitting(true);
    setTName(true); setTEmail(true); setTPhone(true); setTRole(true); if (role === "staff") setTRate(true);

    const trimmedName = name.replace(/\s+/g, " ").trim();
    const nameOk = /^[a-zA-Z\s.'-]{2,}$/.test(trimmedName) && trimmedName.split(" ").length >= 2 && trimmedName.split(" ").every(p => p.length >= 2);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const phoneOk = new RegExp(`^${callingCode}-\\d{3}-\\d{3}-\\d{4}$`).test(`${callingCode}-${phone}`);
    const roleOk = role === "admin" || role === "staff";
    const rateOk = role === "admin" || (role === "staff" && !!hourlyRate);

    setNameError(nameOk ? "" : "Enter full name (e.g. Jane Smith).");
    setEmailError(emailOk ? "" : "Enter a valid email address.");
    setPhoneError(phoneOk ? "" : `Invalid format. Ex: ${callingCode}-XXX-XXX-XXXX`);
    setRoleError(roleOk ? "" : "Please select a role.");
    if (role === "staff") setHourlyRateError(rateOk ? "" : "Hourly rate is required for staff.");

    const valid = nameOk && emailOk && phoneOk && roleOk && rateOk;
    if (!valid) { setSubmitting(false); return; }

    try {
      const res = await fetch(`${api}/api/workers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email,
          phone,
          role,
          hourlyRate: role === "staff" ? parseFloat(hourlyRate || "0") : 0,
          password: "",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || "Failed to add worker");
      }

      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

      await refetchAll();
      setName(""); setEmail(""); setPhone(""); setRole(null); setHourlyRate("");
      setCountryCode("BB"); setCallingCode("1"); setCountry(null);
      setTName(false); setTEmail(false); setTPhone(false); setTRole(false); setTRate(false);
      setNameError(""); setEmailError(""); setPhoneError(""); setRoleError(""); setHourlyRateError("");
      setAddVisible(false);
      Keyboard.dismiss();
    } catch (err) {
      Alert.alert("Error", "Could not add worker.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearForm = () => {
    setName(""); setEmail(""); setPhone(""); setRole(null); setHourlyRate("");
    setCountryCode("BB"); setCallingCode("1"); setCountry(null);
    setTName(false); setTEmail(false); setTPhone(false); setTRole(false); setTRate(false);
    setNameError(""); setEmailError(""); setPhoneError(""); setRoleError(""); setHourlyRateError("");
  };

  const handleClockInOut = async (emp: Worker) => {
    if (clockingIds.has(emp._id)) return;
    const setIds = new Set(clockingIds); setIds.add(emp._id); setClockingIds(setIds);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const dateStr = now.toISOString().split("T")[0];

    try {
      if (!emp.clockedIn) {
        await fetch(`${api}/api/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
          body: JSON.stringify({ worker: emp.name, date: dateStr, clockIn: timeStr }),
        });
      } else {
        const res = await fetch(`${api}/api/shifts/last/${encodeURIComponent(emp.name)}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        const activeShift = await res.json();
        if (activeShift?._id) {
          await fetch(`${api}/api/shifts/${activeShift._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ clockOut: timeStr, status: "Completed" }),
          });
        }
      }

      await fetch(`${api}/api/workers/${emp._id}/clock`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

      await refetchAll();
    } catch (err) {
      Alert.alert("Error", "Clock in/out failed.");
    } finally {
      const s2 = new Set(clockingIds); s2.delete(emp._id); setClockingIds(s2);
    }
  };

  const handleLunchToggle = async (emp: Worker) => {
    if (lunchingIds.has(emp._id)) return;
    const setIds = new Set(lunchingIds); setIds.add(emp._id); setLunchingIds(setIds);

    try {
      const res = await fetch(`${api}/api/shifts/last/${encodeURIComponent(emp.name)}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      const json = await res.json();
      const activeShift: Shift | undefined = (json && (json.shift || json)) as any;

      if (!activeShift?._id || activeShift.clockOut) {
        Alert.alert("No active shift", "You must be clocked in to start/end lunch.");
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit",
      });

      let patch: Partial<Shift> | null = null;
      let successMsg = "";
      if (!activeShift.lunchStart) {
        patch = { lunchStart: timeStr };
        successMsg = "Lunch started.";
      } else if (activeShift.lunchStart && !activeShift.lunchEnd) {
        patch = { lunchEnd: timeStr };
        successMsg = "Lunch ended.";
      } else {
        Alert.alert("Lunch already recorded", "Lunch start and end are already set for this shift.");
      }

      if (patch) {
        const put = await fetch(`${api}/api/shifts/${activeShift._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
          body: JSON.stringify(patch),
        });
        if (!put.ok) {
          const e = await put.text();
          throw new Error(e || "Failed to update lunch");
        }

        setShifts(prev => prev.map(s => (s._id === activeShift._id ? { ...s, ...patch } : s)));
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        Alert.alert("Success", successMsg);
      }

      await fetchShifts();
    } catch (err) {
      Alert.alert("Error", "Lunch update failed.");
    } finally {
      const s2 = new Set(lunchingIds); s2.delete(emp._id); setLunchingIds(s2);
    }
  };

  const confirmDelete = (emp: Worker) => {
    Alert.alert("Delete Worker", `Delete ${emp.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEmployee(emp._id) },
    ]);
  };

  const deleteEmployee = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${api}/api/workers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      await refetchAll();
    } catch {
      Alert.alert("Error", "Could not delete worker.");
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (emp: Worker) => {
    setEditing({
      ...emp,
      role: (emp.role as Role) || "staff",
    });
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`${api}/api/workers/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          name: editing.name,
          email: editing.email,
          phone: editing.phone,
          role: editing.role,
          hourlyRate: editing.role === "staff" ? editing.hourlyRate ?? 0 : 0,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditVisible(false);
      setEditing(null);
      await refetchAll();
    } catch {
      Alert.alert("Error", "Could not update worker.");
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      if (Platform.OS === "android") {
        ToastAndroid.show(`${label} copied`, ToastAndroid.SHORT);
      } else {
        Alert.alert("Copied", `${label} copied to clipboard`);
      }
    } catch {}
  };

  const fabBottom = useMemo(() => {
    const base = 20 + insets.bottom;
    if (isIOS && isLandscape) return base + 12;
    return base;
  }, [insets.bottom, isIOS, isLandscape]);

  const fabRight = useMemo(() => 16 + insets.right, [insets.right]);

  // ---------- Filter Chips ----------
  const FILTER_CHIPS = [
    { key: "all",     label: "All" },
    { key: "active",  label: "Active" },
    { key: "offduty", label: "Off Duty" },
    { key: "onbreak", label: "On Break" },
  ] as const;

  // ---------- Sticky mobile header ----------
  const StickyMobileHeader = useMemo(
    () => (
      <View style={[styles.stickyHeader, headerElevated && styles.stickyHeaderElevated]}>
        <Text style={styles.largeTitle} numberOfLines={1} ellipsizeMode="tail">Staff</Text>
      </View>
    ),
    [headerElevated]
  );

  // ---------- Mobile list header ----------
  const MobileListHeader = useMemo(
    () => (
      <View style={{ paddingBottom: 8 }}>
        {/* Stats summary row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.success }]}>{workers.filter(e => e.clockedIn).length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.warning }]}>
              {shifts.filter(s => s.status !== "Completed" && !!s.lunchStart && !s.lunchEnd).length}
            </Text>
            <Text style={styles.statLabel}>On Lunch</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.accent }]}>{workers.filter(e => String(e.role) === "staff").length}</Text>
            <Text style={styles.statLabel}>Staff</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.accentDark }]}>{workers.filter(e => String(e.role) === "admin").length}</Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, email, or phone"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {FILTER_CHIPS.map(chip => (
            <Pressable
              key={chip.key}
              onPress={() => setActiveFilter(chip.key as any)}
              android_ripple={{ color: Colors.accent + '20', borderless: false }}
              style={[
                styles.filterChip,
                activeFilter === chip.key && styles.filterChipActive,
              ]}
            >
              <Text style={[
                styles.filterChipText,
                activeFilter === chip.key && styles.filterChipTextActive,
              ]}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    ),
    [workers, shifts, searchQuery, activeFilter, FILTER_CHIPS]
  );

  // ---------- Item renderer ----------
  const renderMobileCard = ({ item, index }: { item: Worker; index: number }) => {
    const emp = item;
    const empShifts = shiftsByEmployee.get(emp.name) || [];
    const last = empShifts[0];

    const lunchState: "none" | "canStart" | "canEnd" | "done" =
      !last || last.clockOut
        ? "none"
        : !last.lunchStart
          ? "canStart"
          : last.lunchStart && !last.lunchEnd
            ? "canEnd"
            : "done";

    const liveMs = last && !last.clockOut ? shiftEnd(last).getTime() - shiftStart(last).getTime() : 0;
    const jobsToday = empShifts.filter(s => s.date === new Date().toISOString().split("T")[0]).length;

    const CardInner = (
      <ReAnimated.View entering={FadeInDown.delay(index * 60).duration(300)}>
        <Pressable
          android_ripple={{ color: Colors.accent + '18', borderless: false }}
          style={styles.card}
          onPress={() => {
            const s = new Set(expandedCards);
            s.has(emp._id) ? s.delete(emp._id) : s.add(emp._id);
            setExpandedCards(s);
          }}
        >
          <View style={styles.cardRow}>
            {/* Avatar using Avatar component */}
            <Avatar name={emp.name} size={48} />

            {/* Center info */}
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.empName} numberOfLines={1}>{emp.name}</Text>
              <View style={styles.roleBadgeWrap}>
                <Badge
                  status={emp.role === "admin" ? "active" : "success"}
                  label={String(emp.role).toUpperCase()}
                  size="sm"
                />
              </View>
              <Text style={styles.jobsText}>{jobsToday} job{jobsToday === 1 ? "" : "s"} today</Text>
            </View>

            {/* Right: status dot + label */}
            <View style={styles.cardRight}>
              <View style={[styles.statusDot, emp.clockedIn ? styles.statusDotOn : styles.statusDotOff]} />
              <Text style={emp.clockedIn ? styles.timeActive : styles.timeInactive}>
                {emp.clockedIn ? "Clocked in" : "Off duty"}
              </Text>
              {last && !last.clockOut && (
                <Text style={styles.liveTimer}>{formatDuration(liveMs)}</Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[
                styles.clockBtn,
                emp.clockedIn ? { backgroundColor: Colors.error } : { backgroundColor: Colors.success },
                clockingIds.has(emp._id) && { opacity: 0.7 },
              ]}
              onPress={() => handleClockInOut(emp)}
              disabled={clockingIds.has(emp._id)}
              accessibilityRole="button"
            >
              <Ionicons name={emp.clockedIn ? "time-outline" : "play-circle-outline"} size={14} color={Colors.white} />
              <Text style={styles.clockBtnText}>
                {clockingIds.has(emp._id) ? "…" : emp.clockedIn ? "Clock Out" : "Clock In"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.lunchBtn,
                (lunchState === "none" || lunchState === "done" || lunchingIds.has(emp._id)) && { opacity: 0.45 },
                lunchState === "canStart" && { backgroundColor: Colors.warning },
                lunchState === "canEnd" && { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
              ]}
              onPress={() => handleLunchToggle(emp)}
              disabled={lunchState === "none" || lunchState === "done" || lunchingIds.has(emp._id)}
              accessibilityRole="button"
            >
              <Ionicons name="fast-food-outline" size={14} color={lunchState === "canEnd" ? Colors.accent : Colors.white} />
              <Text style={[styles.lunchBtnText, lunchState === "canEnd" && { color: Colors.accent }]}>
                {lunchingIds.has(emp._id) ? "…" : lunchState === "canStart" ? "Lunch" : lunchState === "canEnd" ? "End Lunch" : "Lunch"}
              </Text>
            </TouchableOpacity>

            {Platform.OS !== "web" && (
              <>
                <TouchableOpacity style={styles.iconBtnSmall} onPress={() => openEdit(emp)}>
                  <Ionicons name="create-outline" size={16} color={Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtnSmall, { backgroundColor: Colors.errorBg }]} onPress={() => confirmDelete(emp)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Shift meta */}
          {(() => {
            const empShifts2 = shiftsByEmployee.get(emp.name) || [];
            const last2 = empShifts2[0];
            const liveMs2 = last2 && !last2.clockOut ? shiftEnd(last2).getTime() - shiftStart(last2).getTime() : 0;
            return last2 ? (
              <Text style={styles.shiftMeta}>
                {last2.status === "Completed"
                  ? `Last shift: ${formatDuration(shiftEnd(last2).getTime() - shiftStart(last2).getTime())}`
                  : `Active: ${formatDuration(liveMs2)}`}
              </Text>
            ) : <Text style={styles.shiftMeta}>No shifts yet</Text>;
          })()}

          {/* History toggle */}
          <TouchableOpacity
            onPress={() => {
              const s = new Set(expandedCards);
              s.has(emp._id) ? s.delete(emp._id) : s.add(emp._id);
              setExpandedCards(s);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.toggleHistory}>
              {expandedCards.has(emp._id) ? "Hide history" : "View history"}
            </Text>
          </TouchableOpacity>

          {expandedCards.has(emp._id) && (
            <View style={styles.history}>
              {(shiftsByEmployee.get(emp.name) || []).slice(0, 3).map((s) => {
                const dur = formatDuration(shiftEnd(s).getTime() - shiftStart(s).getTime());
                return (
                  <View key={s._id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{s.date}</Text>
                    <Text style={styles.historyDur}>{dur}</Text>
                    <Text style={[styles.historyStatus, s.status === "Completed" ? styles.statusDone : styles.statusActive]}>
                      {s.status}
                    </Text>
                  </View>
                );
              })}
              {(shiftsByEmployee.get(emp.name) || []).length === 0 && <Text style={styles.historyEmpty}>No shift records.</Text>}
            </View>
          )}
        </Pressable>
      </ReAnimated.View>
    );

    if (Platform.OS === "web") return CardInner;
    return (
      <Swipeable renderRightActions={() => renderRightActions(emp)} overshootRight={false}>
        {CardInner}
      </Swipeable>
    );
  };

  // ---------- Web table row ----------
  const renderWebRow = ({ item: emp, index }: { item: Worker; index: number }) => {
    const empShifts = shiftsByEmployee.get(emp.name) || [];
    const last = empShifts[0];
    const active = !!last && !last.clockOut;
    const lunching = !!last && !!last.lunchStart && !last.lunchEnd;

    return (
      <View style={[styles.webTr, index % 2 === 1 && styles.webTrAlt]}>
        <View style={[styles.webTd, { flex: 2, gap: 8, alignItems: "center", flexDirection: "row" }]}>
          <View style={[styles.webDot, active ? styles.webDotOn : styles.webDotOff]} />
          <Text style={styles.webName} numberOfLines={1} ellipsizeMode="tail">{emp.name}</Text>
        </View>
        <TouchableOpacity style={[styles.webTd, { flex: 2 }]} onPress={() => copy("Email", emp.email)}>
          <Text style={styles.webCellText} numberOfLines={1} ellipsizeMode="middle">{emp.email}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.webTd, { flex: 1.5 }]} onPress={() => copy("Phone", emp.phone)}>
          <Text style={styles.webCellText} numberOfLines={1}>{emp.phone}</Text>
        </TouchableOpacity>
        <View style={[styles.webTd, { flex: 1 }]}>
          <View style={[styles.roleBadge, emp.role === "admin" ? styles.roleAdmin : styles.roleStaff]}>
            <Text style={[styles.roleText, emp.role === "admin" ? { color: Colors.accent } : { color: Colors.successText }]}>
              {String(emp.role).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.webTd, { flex: 1 }]}>
          <Text style={{ fontSize: 12, color: active ? Colors.success : Colors.textMuted, fontWeight: "600" }}>
            {active ? (lunching ? "On Lunch" : "Active") : "Off Duty"}
          </Text>
        </View>
        <View style={[styles.webTd, { flex: 1.8, alignItems: "flex-end" }]}>
          <View style={styles.webActions}>
            <TouchableOpacity onPress={() => handleClockInOut(emp)} style={[styles.webBtn, active ? styles.webBtnDanger : styles.webBtnSuccess]}>
              <Ionicons name={active ? "time-outline" : "play-circle-outline"} size={14} color={Colors.white} />
              <Text style={styles.webBtnText}>{active ? "Out" : "In"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleLunchToggle(emp)} disabled={!active} style={[styles.webBtn, lunching ? styles.webBtnInfo : styles.webBtnWarn, !active && { opacity: 0.4 }]}>
              <Ionicons name="fast-food-outline" size={14} color={Colors.white} />
              <Text style={styles.webBtnText}>{lunching ? "End" : "Lunch"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEdit(emp)} style={styles.webIconBtn}>
              <Ionicons name="create-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(emp)} style={styles.webIconBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderRightActions = (emp: Worker) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: Colors.warning }]} onPress={() => openEdit(emp)}>
        <Ionicons name="create-outline" size={20} color={Colors.black} />
        <Text style={styles.swipeText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: Colors.error }]} onPress={() => confirmDelete(emp)}>
        <Ionicons name="trash-outline" size={20} color={Colors.white} />
        <Text style={[styles.swipeText, { color: Colors.white }]}>
          {deletingId === emp._id ? "Deleting…" : "Delete"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ---------- Web toolbar header ----------
  const WebToolbarHeader = useMemo(() => (
    <View style={styles.webHeaderBlock}>
      <View style={styles.webToolbarRow}>
        <View style={styles.webSearchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
          <TextInput
            style={styles.webSearchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name, email, phone…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View style={styles.webFilterWrap}>
          <DropDownPicker
            open={openRoleFilter}
            value={roleFilter}
            items={[
              { label: "All Roles", value: "all" },
              { label: "Admin", value: "admin" },
              { label: "Staff", value: "staff" },
            ]}
            setOpen={setOpenRoleFilter}
            setValue={(cb) => setRoleFilter((cb as any)(roleFilter))}
            placeholder="Role"
            listMode="MODAL"
            style={styles.webDropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            modalTitle="Filter by role"
          />
        </View>
        <View style={styles.webChipsRow}>
          <View style={[styles.webChip, styles.webChipGreen]}><Text style={styles.webChipText}>Active {workers.filter(e => e.clockedIn).length}</Text></View>
          <View style={[styles.webChip, styles.webChipBlue]}><Text style={styles.webChipText}>Lunch {shifts.filter(s => s.status !== "Completed" && !!s.lunchStart && !s.lunchEnd).length}</Text></View>
          <View style={styles.webChip}><Text style={styles.webChipText}>Staff {workers.filter(e => String(e.role) === "staff").length}</Text></View>
          <View style={styles.webChip}><Text style={styles.webChipText}>Admins {workers.filter(e => String(e.role) === "admin").length}</Text></View>
        </View>
      </View>
      <View style={styles.webTableHeader}>
        <Text style={[styles.webTh, { flex: 2 }]}>Worker</Text>
        <Text style={[styles.webTh, { flex: 2 }]}>Email</Text>
        <Text style={[styles.webTh, { flex: 1.5 }]}>Phone</Text>
        <Text style={[styles.webTh, { flex: 1 }]}>Role</Text>
        <Text style={[styles.webTh, { flex: 1 }]}>Status</Text>
        <Text style={[styles.webTh, { flex: 1.8, textAlign: "left" }]}>Actions</Text>
      </View>
    </View>
  ), [workers, shifts, searchQuery, roleFilter, openRoleFilter]);

  // ---------- Render ----------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isIOS ? "padding" : undefined}
      >
        {/* FIXED header: web only */}
        {isWeb ? (
          <View style={[styles.headerBand, styles.headerBandWeb, headerElevated && styles.headerBandElevated]}>
            <View style={[styles.headerRow, styles.headerRowWeb]}>
              <Text style={styles.largeTitle} numberOfLines={1}>Staff</Text>
              <TouchableOpacity
                onPress={() => setAddVisible(true)}
                style={styles.webPrimaryBtn}
                accessibilityRole="button"
              >
                <Ionicons name="person-add-outline" size={18} color={Colors.white} />
                <Text style={styles.webPrimaryBtnText}>Add Worker</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          {isWebTable ? (
            <FlatList
              style={{ flex: 1 }}
              data={chipFilteredEmployees}
              key={"web-table"}
              keyExtractor={(emp) => emp._id}
              renderItem={renderWebRow}
              ListHeaderComponent={WebToolbarHeader}
              stickyHeaderIndices={[0]}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 }}
              initialNumToRender={30}
              windowSize={9}
              onScroll={(e) => setHeaderElevated(e.nativeEvent.contentOffset.y > 2)}
              scrollEventThrottle={16}
            />
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={dataCards}
              key={`cards-${columns}-${isWebCards ? "narrow" : "wide"}`}
              keyExtractor={(item: any) =>
                (item as any)?.__type ? `k-${(item as any).__type}` : (item as Worker)._id
              }
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? { gap: 12, alignItems: "flex-start" } : undefined}
              renderItem={({ item, index }) => {
                if (useInlineStickyHeader && (item as any).__type === "stickyHeader") return StickyMobileHeader;
                if (useInlineStickyHeader && (item as any).__type === "mobileHeader") return MobileListHeader;
                return renderMobileCard({ item, index } as any);
              }}
              stickyHeaderIndices={useInlineStickyHeader ? [0] : undefined}
              ListHeaderComponent={!useInlineStickyHeader ? MobileListHeader : undefined}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 16,
                paddingBottom: 120 + insets.bottom,
                backgroundColor: Colors.background,
                width: "100%",
                maxWidth: 1200,
                alignSelf: "center",
              }}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews={!isWeb}
              onScroll={(e) => setHeaderElevated(e.nativeEvent.contentOffset.y > 2)}
              scrollEventThrottle={16}
              ListEmptyComponent={
                !loading ? (
                  <EmptyState
                    icon={<Ionicons name="people-outline" size={64} color={Colors.textMuted} />}
                    title="No Staff Found"
                    subtitle="Add your first team member to get started"
                    actionLabel="Add Worker"
                    onAction={() => setAddVisible(true)}
                  />
                ) : null
              }
            />
          )}
        </View>

        {/* FAB (native only) */}
        {!isWeb && (
          <TouchableOpacity
            style={[styles.fab, { bottom: fabBottom, right: fabRight }]}
            onPress={() => setAddVisible(true)}
            accessibilityLabel="Add worker"
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color={Colors.white} />
          </TouchableOpacity>
        )}

        {/* Add Worker Modal */}
        <Modal
          visible={addVisible}
          transparent
          animationType="fade"
          presentationStyle={isIOS ? "overFullScreen" : undefined}
          statusBarTranslucent
          supportedOrientations={["portrait", "landscape"]}
          onRequestClose={() => setAddVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setAddVisible(false)} />

          {isIOS ? (
            <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
              <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8), maxWidth: 720, alignSelf: "center", width: "100%", maxHeight: "88%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text style={styles.sectionTitle}>Add Worker</Text>
                  <View style={[styles.formRow, !isWeb && isWide && styles.formRowWide]}>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Full Name</Text>
                      <TextInput style={[styles.input, tName && nameError ? styles.inputError : null]} value={name} onChangeText={validateName} onBlur={() => setTName(true)} placeholder="e.g. Jane Smith" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" returnKeyType="next" />
                      {tName && nameError ? <Text style={styles.error}>{nameError}</Text> : <Text style={styles.helper}>First & last name.</Text>}
                    </View>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Email</Text>
                      <TextInput style={[styles.input, tEmail && emailError ? styles.inputError : null]} value={email} onChangeText={validateEmail} onBlur={() => setTEmail(true)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="name@example.com" placeholderTextColor={Colors.textSecondary} returnKeyType="next" />
                      {tEmail && emailError ? <Text style={styles.error}>{emailError}</Text> : <Text style={styles.helper}>Used for login & receipts.</Text>}
                    </View>
                  </View>
                  <View style={[styles.formRow, !isWeb && isWide && styles.formRowWide]}>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Phone</Text>
                      <View style={[styles.inputWrapper, tPhone && phoneError ? styles.inputError : null]}>
                        <CountryPickerCompat countryCode={countryCode} onSelect={onSelectCountry} callingCode={callingCode} />
                        <Text style={styles.prefix}>+{callingCode}</Text>
                        <TextInput value={phone} onChangeText={validatePhone} onBlur={() => setTPhone(true)} keyboardType="number-pad" inputMode="numeric" placeholder={callingCode === "1" ? "XXX-XXX-XXXX" : "Phone number"} placeholderTextColor={Colors.textSecondary} maxLength={12} style={{ flex: 1, paddingVertical: isIOS ? 14 : 10, paddingLeft: 10 }} />
                      </View>
                      {tPhone && phoneError ? <Text style={styles.error}>{phoneError}</Text> : <Text style={styles.helper}>Auto-formatted as you type.</Text>}
                    </View>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Role</Text>
                      <DropDownPicker open={openRole} value={role} items={[{ label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }]} setOpen={setOpenRole} setValue={(cb) => { const next = (cb as any)(role); validateRole(next); }} onChangeValue={(v) => validateRole(v as Role | null)} placeholder="Select role" listMode="MODAL" style={styles.dropdown} dropDownContainerStyle={styles.dropdownContainer} />
                      {tRole && roleError ? <Text style={styles.error}>{roleError}</Text> : <Text style={styles.helper}>Choose Admin or Staff.</Text>}
                    </View>
                  </View>
                  {role === "staff" && (
                    <View style={styles.formRow}>
                      <View style={[styles.formCol, styles.formHalf]}>
                        <Text style={styles.label}>Hourly rate (BBD)</Text>
                        <TextInput style={[styles.input, tRate && hourlyRateError ? styles.inputError : null]} value={hourlyRate} onChangeText={sanitiseRate} onBlur={() => setTRate(true)} keyboardType={isIOS ? "decimal-pad" : "numeric"} inputMode="decimal" placeholder="e.g. 12.50" placeholderTextColor={Colors.textSecondary} maxLength={7} />
                        {tRate && hourlyRateError ? <Text style={styles.error}>{hourlyRateError}</Text> : <Text style={styles.helper}>Up to 3 digits + 3 decimals.</Text>}
                      </View>
                    </View>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handleAddEmployee} disabled={submitting}>
                      <Ionicons name="person-add-outline" size={18} color={Colors.white} />
                      <Text style={styles.primaryBtnText}>{submitting ? "Saving…" : "Add Worker"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={clearForm}><Text style={styles.secondaryBtnText}>Clear</Text></TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: Colors.border }]} onPress={() => setAddVisible(false)}><Text style={styles.secondaryBtnText}>Close</Text></TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboardHeight }}>
              <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8), maxWidth: 720, alignSelf: "center", width: "100%", maxHeight: "88%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text style={styles.sectionTitle}>Add Worker</Text>
                  <View style={[styles.formRow, !isWeb && isWide && styles.formRowWide]}>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Full Name</Text>
                      <TextInput style={[styles.input, tName && nameError ? styles.inputError : null]} value={name} onChangeText={validateName} onBlur={() => setTName(true)} placeholder="e.g. Jane Smith" placeholderTextColor={Colors.textSecondary} autoCapitalize="words" returnKeyType="next" />
                      {tName && nameError ? <Text style={styles.error}>{nameError}</Text> : <Text style={styles.helper}>First & last name.</Text>}
                    </View>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Email</Text>
                      <TextInput style={[styles.input, tEmail && emailError ? styles.inputError : null]} value={email} onChangeText={validateEmail} onBlur={() => setTEmail(true)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="name@example.com" placeholderTextColor={Colors.textSecondary} returnKeyType="next" />
                      {tEmail && emailError ? <Text style={styles.error}>{emailError}</Text> : <Text style={styles.helper}>Used for login & receipts.</Text>}
                    </View>
                  </View>
                  <View style={[styles.formRow, !isWeb && isWide && styles.formRowWide]}>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Phone</Text>
                      <View style={[styles.inputWrapper, tPhone && phoneError ? styles.inputError : null]}>
                        <CountryPickerCompat countryCode={countryCode} onSelect={onSelectCountry} callingCode={callingCode} />
                        <Text style={styles.prefix}>+{callingCode}</Text>
                        <TextInput value={phone} onChangeText={validatePhone} onBlur={() => setTPhone(true)} keyboardType="number-pad" inputMode="numeric" placeholder={callingCode === "1" ? "XXX-XXX-XXXX" : "Phone number"} placeholderTextColor={Colors.textSecondary} maxLength={12} style={{ flex: 1, paddingVertical: isIOS ? 14 : 10, paddingLeft: 10 }} />
                      </View>
                      {tPhone && phoneError ? <Text style={styles.error}>{phoneError}</Text> : <Text style={styles.helper}>Auto-formatted as you type.</Text>}
                    </View>
                    <View style={[styles.formCol, !isWeb && isWide && styles.formHalf]}>
                      <Text style={styles.label}>Role</Text>
                      <DropDownPicker open={openRole} value={role} items={[{ label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }]} setOpen={setOpenRole} setValue={(cb) => { const next = (cb as any)(role); validateRole(next); }} onChangeValue={(v) => validateRole(v as Role | null)} placeholder="Select role" listMode="MODAL" style={styles.dropdown} dropDownContainerStyle={styles.dropdownContainer} />
                      {tRole && roleError ? <Text style={styles.error}>{roleError}</Text> : <Text style={styles.helper}>Choose Admin or Staff.</Text>}
                    </View>
                  </View>
                  {role === "staff" && (
                    <View style={styles.formRow}>
                      <View style={[styles.formCol, styles.formHalf]}>
                        <Text style={styles.label}>Hourly rate (BBD)</Text>
                        <TextInput style={[styles.input, tRate && hourlyRateError ? styles.inputError : null]} value={hourlyRate} onChangeText={sanitiseRate} onBlur={() => setTRate(true)} keyboardType={isIOS ? "decimal-pad" : "numeric"} inputMode="decimal" placeholder="e.g. 12.50" placeholderTextColor={Colors.textSecondary} maxLength={7} />
                        {tRate && hourlyRateError ? <Text style={styles.error}>{hourlyRateError}</Text> : <Text style={styles.helper}>Up to 3 digits + 3 decimals.</Text>}
                      </View>
                    </View>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handleAddEmployee} disabled={submitting}>
                      <Ionicons name="person-add-outline" size={18} color={Colors.white} />
                      <Text style={styles.primaryBtnText}>{submitting ? "Saving…" : "Add Worker"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={clearForm}><Text style={styles.secondaryBtnText}>Clear</Text></TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: Colors.border }]} onPress={() => setAddVisible(false)}><Text style={styles.secondaryBtnText}>Close</Text></TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </Modal>

        {/* Edit Modal */}
        <Modal visible={editVisible} transparent animationType="fade" presentationStyle={isIOS ? "overFullScreen" : undefined} statusBarTranslucent supportedOrientations={["portrait", "landscape"]} onRequestClose={() => setEditVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)} />
          {Platform.OS === "ios" ? (
            <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
              <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8), maxWidth: 720, alignSelf: "center", width: "100%", maxHeight: "88%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text style={styles.sectionTitle}>Edit Worker</Text>
                  {editing && (
                    <>
                      <Text style={styles.label}>Full Name</Text>
                      <TextInput style={styles.input} value={editing.name} onChangeText={(t) => setEditing({ ...editing, name: t })} autoCapitalize="words" />
                      <Text style={styles.label}>Email</Text>
                      <TextInput style={styles.input} value={editing.email} onChangeText={(t) => setEditing({ ...editing, email: t })} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
                      <Text style={styles.label}>Phone</Text>
                      <TextInput style={styles.input} value={editing.phone} onChangeText={(t) => setEditing({ ...editing, phone: t })} keyboardType="number-pad" inputMode="numeric" />
                      <Text style={styles.label}>Role</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["admin", "staff"] as Role[]).map((r) => (
                          <TouchableOpacity key={r} style={[styles.badgeChoice, editing.role === r && { backgroundColor: Colors.accentMuted, borderColor: Colors.accent }]} onPress={() => setEditing({ ...editing, role: r })}>
                            <Text style={{ color: Colors.accent, fontWeight: "600" }}>{r.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {editing.role === "staff" && (
                        <>
                          <Text style={styles.label}>Hourly rate (BBD)</Text>
                          <TextInput style={styles.input} value={String(editing.hourlyRate ?? "")} onChangeText={(v) => { let x = v.replace(/[^\d.]/g, ""); const dot = x.indexOf("."); if (dot !== -1) x = x.slice(0, dot + 1) + x.slice(dot + 1).replace(/\./g, ""); x = x.replace(/^(\d{0,3})(\d*)$/, (_m, a, b) => a + b); x = x.replace(/^(\d{1,3})(?:\.(\d{0,3}))?.*$/, (_m, a, b) => (b !== undefined ? `${a}.${b}` : a)); setEditing({ ...editing, hourlyRate: x ? Number(x) : (undefined as any) }); }} keyboardType={isIOS ? "decimal-pad" : "numeric"} inputMode="decimal" placeholder="e.g. 12.50" maxLength={7} />
                        </>
                      )}
                      <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditVisible(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={saveEdit}><Ionicons name="save-outline" size={18} color={Colors.white} /><Text style={styles.primaryBtnText}>Save</Text></TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboardHeight }}>
              <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8), maxWidth: 720, alignSelf: "center", width: "100%", maxHeight: "88%" }]}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text style={styles.sectionTitle}>Edit Worker</Text>
                  {editing && (
                    <>
                      <Text style={styles.label}>Full Name</Text>
                      <TextInput style={styles.input} value={editing.name} onChangeText={(t) => setEditing({ ...editing, name: t })} autoCapitalize="words" />
                      <Text style={styles.label}>Email</Text>
                      <TextInput style={styles.input} value={editing.email} onChangeText={(t) => setEditing({ ...editing, email: t })} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
                      <Text style={styles.label}>Phone</Text>
                      <TextInput style={styles.input} value={editing.phone} onChangeText={(t) => setEditing({ ...editing, phone: t })} keyboardType="number-pad" inputMode="numeric" />
                      <Text style={styles.label}>Role</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {(["admin", "staff"] as Role[]).map((r) => (
                          <TouchableOpacity key={r} style={[styles.badgeChoice, editing.role === r && { backgroundColor: Colors.accentMuted, borderColor: Colors.accent }]} onPress={() => setEditing({ ...editing, role: r })}>
                            <Text style={{ color: Colors.accent, fontWeight: "600" }}>{r.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {editing.role === "staff" && (
                        <>
                          <Text style={styles.label}>Hourly rate (BBD)</Text>
                          <TextInput style={styles.input} value={String(editing.hourlyRate ?? "")} onChangeText={(v) => { let x = v.replace(/[^\d.]/g, ""); const dot = x.indexOf("."); if (dot !== -1) x = x.slice(0, dot + 1) + x.slice(dot + 1).replace(/\./g, ""); x = x.replace(/^(\d{0,3})(\d*)$/, (_m, a, b) => a + b); x = x.replace(/^(\d{1,3})(?:\.(\d{0,3}))?.*$/, (_m, a, b) => (b !== undefined ? `${a}.${b}` : a)); setEditing({ ...editing, hourlyRate: x ? Number(x) : (undefined as any) }); }} keyboardType={isIOS ? "decimal-pad" : "numeric"} inputMode="decimal" placeholder="e.g. 12.50" maxLength={7} />
                        </>
                      )}
                      <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditVisible(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={saveEdit}><Ionicons name="save-outline" size={18} color={Colors.white} /><Text style={styles.primaryBtnText}>Save</Text></TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default gestureHandlerRootHOC(EmployeesScreen);

const styles = StyleSheet.create({
  // Header band (web fixed)
  headerBand: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBandWeb: { backgroundColor: Colors.white, borderBottomColor: Colors.border, paddingTop: 80, paddingVertical: 12, paddingHorizontal: 24, position: "sticky" as any, top: 0, zIndex: 10 },
  headerBandElevated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, ...Platform.select({ ios: { shadowColor: Colors.black, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 3 } }) },
  headerRow: { width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  headerRowWeb: { maxWidth: 99999, alignSelf: "stretch" },

  // Sticky mobile header
  stickyHeader: { backgroundColor: Colors.background, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, zIndex: 10 },
  stickyHeaderElevated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  largeTitle: { fontSize: 28, fontWeight: "800", color: Colors.textPrimary, letterSpacing: -0.5 },

  // Stats row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2, fontWeight: "600" },

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

  // Filter chips
  chipsRow: { flexDirection: "row", gap: 8, paddingBottom: 100 },
  filterChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surfaceAlt },
  filterChipActive: { backgroundColor: Colors.accent },
  filterChipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontWeight: "700" },

  // Worker card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  cardRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800", color: Colors.accent },
  empName: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary },
  roleBadgeWrap: { flexDirection: "row", marginTop: 4 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  roleAdmin: { backgroundColor: Colors.accentMuted, borderColor: Colors.accentMuted },
  roleStaff: { backgroundColor: Colors.successBg, borderColor: Colors.successBg },
  roleText: { fontSize: 10, fontWeight: "700" },
  jobsText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  cardRight: { alignItems: "flex-end", gap: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotOn: { backgroundColor: Colors.success },
  statusDotOff: { backgroundColor: Colors.textMuted },
  timeActive: { fontSize: 11, fontWeight: "600", color: Colors.success },
  timeInactive: { fontSize: 11, color: Colors.textMuted },
  liveTimer: { fontSize: 10, color: Colors.textMuted, fontWeight: "500" },

  cardActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  clockBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  clockBtnText: { fontSize: 12, fontWeight: "700", color: Colors.white },
  lunchBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.border, borderWidth: 1.5, borderColor: "transparent" },
  lunchBtnText: { fontSize: 12, fontWeight: "700", color: Colors.white },
  iconBtnSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center" },

  shiftMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  toggleHistory: { fontSize: 12, color: Colors.accent, marginTop: 6, fontWeight: "600" },
  history: { marginTop: 8, gap: 6 },
  historyRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  historyDate: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  historyDur: { fontSize: 12, color: Colors.textPrimary, fontWeight: "600" },
  historyStatus: { fontSize: 11, fontWeight: "700" },
  historyEmpty: { fontSize: 12, color: Colors.textMuted },
  statusDone: { color: Colors.success },
  statusActive: { color: Colors.warning },

  // Swipe actions
  swipeActions: { flexDirection: "row", height: "100%" },
  swipeBtn: { paddingHorizontal: 16, alignItems: "center", justifyContent: "center", gap: 4 },
  swipeText: { fontSize: 12, fontWeight: "700", color: Colors.black },

  // FAB
  fabWrap: { position: "absolute" },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 6 },
    }),
  },

  // Sheet (modal)
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, ...Platform.select({ ios: { shadowColor: Colors.black, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 16 } }) },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: Colors.accent, marginBottom: 12 },

  // Form
  formRow: { gap: 12 },
  formRowWide: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  formCol: { flex: 1 },
  formHalf: { flex: 1 },
  label: { marginTop: 8, marginBottom: 4, color: Colors.textPrimary, fontWeight: "600", fontSize: 13 },
  helper: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 14 : 10, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.background },
  inputError: { borderColor: Colors.error },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderColor: Colors.border, borderWidth: 1.5, borderRadius: 10, backgroundColor: Colors.background, overflow: "hidden" },
  prefix: { fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 6 },
  error: { fontSize: 11, color: Colors.error, marginTop: 2 },
  dropdown: { borderColor: Colors.border, borderRadius: 10, minHeight: 46 },
  dropdownContainer: { borderColor: Colors.border, borderRadius: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  secondaryBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.surfaceAlt },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: "600", fontSize: 14 },
  badgeChoice: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: Colors.border },

  // Web table
  webHeaderBlock: { backgroundColor: Colors.white },
  webToolbarRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, flexWrap: "wrap" },
  webSearchWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, minWidth: 200 },
  webSearchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  webFilterWrap: { width: 140, zIndex: 100 },
  webDropdown: { borderColor: Colors.border, minHeight: 38 },
  dropdownContainerStyle: { borderColor: Colors.border },
  webChipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  webChip: { backgroundColor: Colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  webChipGreen: { backgroundColor: Colors.successBg },
  webChipBlue: { backgroundColor: Colors.accentMuted },
  webChipText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  webTableHeader: { flexDirection: "row", backgroundColor: Colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  webTh: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase" },
  webTr: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  webTrAlt: { backgroundColor: Colors.surfaceAlt },
  webTd: { justifyContent: "center", paddingHorizontal: 4 },
  webDot: { width: 8, height: 8, borderRadius: 4 },
  webDotOn: { backgroundColor: Colors.success },
  webDotOff: { backgroundColor: Colors.textMuted },
  webName: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary },
  webCellText: { fontSize: 13, color: Colors.textSecondary },
  webActions: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  webBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  webBtnSuccess: { backgroundColor: Colors.success },
  webBtnDanger: { backgroundColor: Colors.error },
  webBtnWarn: { backgroundColor: Colors.warning },
  webBtnInfo: { backgroundColor: Colors.accent },
  webBtnText: { fontSize: 11, fontWeight: "700", color: Colors.white },
  webIconBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  webPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  webPrimaryBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },

  // Unused but kept for DropDownPicker compat
  zFix: { zIndex: 100 },
});
