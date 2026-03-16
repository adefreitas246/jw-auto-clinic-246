// constants/Animations.ts
import { Easing } from 'react-native';

export const Duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

export const SpringConfig = {
  /** Snappy press feedback */
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
  /** Smooth card expansion */
  smooth: {
    damping: 28,
    stiffness: 180,
    mass: 1,
  },
  /** Bouncy reveal */
  bouncy: {
    damping: 14,
    stiffness: 200,
    mass: 0.9,
  },
  /** iOS-style modal */
  modal: {
    damping: 30,
    stiffness: 250,
    mass: 1,
  },
} as const;

export const TimingConfig = {
  easeIn: {
    duration: Duration.normal,
    easing: Easing.in(Easing.ease),
  },
  easeOut: {
    duration: Duration.normal,
    easing: Easing.out(Easing.ease),
  },
  easeInOut: {
    duration: Duration.normal,
    easing: Easing.inOut(Easing.ease),
  },
  linear: {
    duration: Duration.normal,
    easing: Easing.linear,
  },
} as const;

export const ScaleValues = {
  pressed: 0.96,
  pressedSmall: 0.94,
  normal: 1,
  elevated: 1.02,
} as const;

export default {
  Duration,
  SpringConfig,
  TimingConfig,
  ScaleValues,
};
