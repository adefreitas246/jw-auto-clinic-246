// app/onboarding-screen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { IS_IOS, SUPPORTS_LIQUID_GLASS } from "@/constants/Platform";
import { Typography } from "@/constants/Typography";

const { width, height } = Dimensions.get("window");

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  image: any;
  gradient: [string, string];
};

const SLIDES: Slide[] = [
  {
    key: "home-transactions",
    title: "Live Dashboard",
    subtitle: "At-a-glance totals and charts for your day.",
    image: require("@/assets/images/onboarding/HomeDashboardTransactions.jpeg"),
    gradient: [Colors.primary, Colors.accent],
  },
  {
    key: "home-workers",
    title: "Manage Staff",
    subtitle: "Filter by role, edit details, export lists.",
    image: require("@/assets/images/onboarding/HomeDashboardEmployees.jpeg"),
    gradient: [Colors.primaryDark, Colors.accentLight],
  },
  {
    key: "home-shifts",
    title: "Shifts & Status",
    subtitle: "Track active/completed shifts and export.",
    image: require("@/assets/images/onboarding/HomeDashboardShifts.jpeg"),
    gradient: [Colors.primary, Colors.accent],
  },
  {
    key: "home-reports",
    title: "Reports",
    subtitle: "Revenue, services, and expenses by period.",
    image: require("@/assets/images/onboarding/HomeDashboardReports.jpeg"),
    gradient: [Colors.primaryDark, Colors.accentLight],
  },
  {
    key: "add-transactions",
    title: "Add Transaction",
    subtitle: "Pick services/specials and calculate instantly.",
    image: require("@/assets/images/onboarding/AddTransactions.jpeg"),
    gradient: [Colors.primary, Colors.accent],
  },
  {
    key: "cart-1",
    title: "Cart & Discounts",
    subtitle: "Edit items, apply discounts, and charge.",
    image: require("@/assets/images/onboarding/AddTransactionsCart2.jpeg"),
    gradient: [Colors.primaryDark, Colors.accentLight],
  },
  {
    key: "cart-2",
    title: "Share or Clear",
    subtitle: "Quick actions before checkout.",
    image: require("@/assets/images/onboarding/AddTransactionsCart3.jpeg"),
    gradient: [Colors.primary, Colors.accent],
  },
  {
    key: "workers-mgmt-1",
    title: "Quick Actions",
    subtitle: "Clock-in, lunch, and history from each card.",
    image: require("@/assets/images/onboarding/EmployeesManagement.jpeg"),
    gradient: [Colors.primaryDark, Colors.accentLight],
  },
  {
    key: "workers-mgmt-2",
    title: "Add Workers",
    subtitle: "Role-based setup with auto-formatted phone.",
    image: require("@/assets/images/onboarding/EmployeesManagement2.jpeg"),
    gradient: [Colors.primary, Colors.accent],
  },
  {
    key: "settings",
    title: "Settings",
    subtitle: "Profile, update checks, what's new, and logout.",
    image: require("@/assets/images/onboarding/Settings.jpeg"),
    gradient: [Colors.primaryDark, Colors.accentLight],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<Animated.FlatList<Slide>>(null);

  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    []
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  const handleDone = useCallback(async () => {
    await AsyncStorage.setItem("hasOnboarded", "true");
    router.replace("/auth/login");
  }, [router]);

  const goNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      handleDone();
    }
  }, [index, handleDone]);

  const goBack = useCallback(() => {
    if (index > 0) {
      flatRef.current?.scrollToIndex({ index: index - 1, animated: true });
    }
  }, [index]);

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Nav row */}
      <View style={[s.navRow, { top: insets.top + 8 }]}>
        <TouchableOpacity
          disabled={index === 0}
          onPress={goBack}
          style={{ opacity: index === 0 ? 0 : 1 }}
          hitSlop={12}
        >
          <Text style={s.navText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDone} hitSlop={12}>
          <Text style={[s.navText, s.navSkip]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <SlideItem item={item} index={i} x={x} />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        initialNumToRender={1}
        windowSize={3}
        removeClippedSubviews
      />

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {SUPPORTS_LIQUID_GLASS && (
          <BlurView
            intensity={60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}
        {!SUPPORTS_LIQUID_GLASS && (
          <View style={[StyleSheet.absoluteFill, s.footerFallback]} />
        )}

        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <Dot key={i} x={x} index={i} />
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={s.ctaWrapper}
        >
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaText}>
              {isLast ? "Get Started" : "Next"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Slide ────────────────────────────────────────────────────────────────────
function SlideItem({
  item,
  index,
  x,
}: {
  item: Slide;
  index: number;
  x: SharedValue<number>;
}) {
  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];

  const titleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          x.value,
          inputRange,
          [width * 0.3, 0, -width * 0.3],
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(x.value, inputRange, [0, 1, 0], Extrapolate.CLAMP),
  }));

  const subStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          x.value,
          inputRange,
          [width * 0.5, 0, -width * 0.5],
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(x.value, inputRange, [0, 1, 0], Extrapolate.CLAMP),
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          x.value,
          inputRange,
          [40, 0, -40],
          Extrapolate.CLAMP
        ),
      },
      {
        scale: interpolate(
          x.value,
          inputRange,
          [0.95, 1, 0.95],
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(x.value, inputRange, [0.6, 1, 0.6], Extrapolate.CLAMP),
  }));

  const PHONE_AR = 19.5 / 9;
  const isSmallScreen = height < 750;
  const maxImageHeight = height * (isSmallScreen ? 0.4 : 0.55);
  const baseWidth = width * 0.82;
  let imgWidth = baseWidth;
  let imgHeight = baseWidth * PHONE_AR;
  if (imgHeight > maxImageHeight) {
    imgHeight = maxImageHeight;
    imgWidth = imgHeight / PHONE_AR;
  }

  return (
    <View style={{ width, height }}>
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.slideContent}>
        {/* Image */}
        <Animated.View
          style={[
            {
              width: imgWidth,
              height: imgHeight,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            },
            imageStyle,
          ]}
        >
          {SUPPORTS_LIQUID_GLASS && (
            <BlurView
              intensity={8}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Image
            source={item.image}
            style={{ width: "100%", height: "100%", resizeMode: "contain" }}
          />
        </Animated.View>

        <Animated.Text style={[s.slideTitle, titleStyle]}>
          {item.title}
        </Animated.Text>

        <Animated.Text style={[s.slideSubtitle, subStyle]}>
          {item.subtitle}
        </Animated.Text>
      </View>
    </View>
  );
}

// ─── Animated dot ─────────────────────────────────────────────────────────────
function Dot({ x, index }: { x: SharedValue<number>; index: number }) {
  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];
  const rStyle = useAnimatedStyle(() => {
    const w = interpolate(x.value, inputRange, [8, 24, 8], Extrapolate.CLAMP);
    const o = interpolate(x.value, inputRange, [0.45, 1, 0.45], Extrapolate.CLAMP);
    return { width: w, opacity: o };
  });
  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: 999, backgroundColor: Colors.white },
        rStyle,
      ]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },

  navRow: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  navText: { color: Colors.white, fontWeight: "600", fontSize: 15 },
  navSkip: { fontWeight: "700", opacity: 0.85 },

  slideContent: {
    flex: 1,
    paddingTop: 80,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 160,
  },
  slideTitle: {
    marginTop: 20,
    color: Colors.white,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  slideSubtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    overflow: "hidden",
    borderTopWidth: IS_IOS ? 0.5 : 0,
    borderTopColor: "rgba(255,255,255,0.25)",
    zIndex: 5,
  },
  footerFallback: {
    backgroundColor: "rgba(10,22,40,0.75)",
  },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },

  ctaWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
  },
  ctaText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
