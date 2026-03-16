// app/onboarding-screen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

const { width, height } = Dimensions.get("window");

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof import("@expo/vector-icons/build/Ionicons").default.glyphMap;
  gradient: readonly [string, string];
};

const SLIDES: Slide[] = [
  {
    key: "clean",
    title: "Your Car, Perfectly Clean",
    subtitle: "Book a professional wash in seconds",
    icon: "car-sport",
    gradient: [Colors.primary, Colors.primaryLight] as const,
  },
  {
    key: "track",
    title: "Track Every Step",
    subtitle: "Live updates from wash to ready",
    icon: "location",
    gradient: [Colors.primaryLight, Colors.accentDark] as const,
  },
  {
    key: "earn",
    title: "Earn While You Wash",
    subtitle: "Points, rewards, and exclusive deals",
    icon: "star",
    gradient: [Colors.accentDark, Colors.primary] as const,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
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

  const isLast = index === SLIDES.length - 1;

  // Background gradient interpolated from current slide
  const currentSlide = SLIDES[index];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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

      {/* Skip button — top right overlay */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={s.skipContainer}
        pointerEvents="box-none"
      >
        <SafeAreaView style={s.skipSafe}>
          <Pressable
            onPress={handleDone}
            hitSlop={12}
            android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
            style={s.skipBtn}
          >
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>

      {/* Footer */}
      <View style={s.footer}>
        {/* Dot indicators */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <Dot key={i} x={x} index={i} />
          ))}
        </View>

        {/* CTA button */}
        <Pressable
          onPress={goNext}
          android_ripple={{ color: Colors.accentDark, borderless: false }}
          style={s.ctaBtn}
        >
          <Text style={s.ctaText}>{isLast ? "Get Started" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Slide ─────────────────────────────────────────────────────────────────────
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

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, inputRange, [0, 1, 0], Extrapolate.CLAMP),
    transform: [
      {
        scale: interpolate(
          x.value,
          inputRange,
          [0.7, 1, 0.7],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, inputRange, [0, 1, 0], Extrapolate.CLAMP),
    transform: [
      {
        translateY: interpolate(
          x.value,
          inputRange,
          [20, 0, -20],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, inputRange, [0, 0.85, 0], Extrapolate.CLAMP),
    transform: [
      {
        translateY: interpolate(
          x.value,
          inputRange,
          [30, 0, -30],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  return (
    <View style={{ width, height }}>
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative circle behind icon */}
      <View style={s.slideContent}>
        <Animated.View style={[s.iconCircle, iconStyle]}>
          <Ionicons name={item.icon as any} size={100} color={Colors.white} />
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

// ─── Animated dot ──────────────────────────────────────────────────────────────
function Dot({ x, index }: { x: SharedValue<number>; index: number }) {
  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];
  const rStyle = useAnimatedStyle(() => {
    const w = interpolate(x.value, inputRange, [8, 24, 8], Extrapolate.CLAMP);
    const o = interpolate(
      x.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolate.CLAMP
    );
    return { width: w, opacity: o };
  });
  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: 4, backgroundColor: Colors.white },
        rStyle,
      ]}
    />
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },

  // Skip overlay
  skipContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 10,
  },
  skipSafe: {
    alignItems: "flex-end",
  },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: Platform.OS === "android" ? 36 : 0,
  },
  skipText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "700",
    opacity: 0.8,
  },

  // Slide
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 160,
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  slideTitle: {
    color: Colors.white,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  slideSubtitle: {
    color: Colors.white,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 8,
    opacity: 0.85,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 44 : 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "rgba(10,22,40,0.35)",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },

  // CTA
  ctaBtn: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 0,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
