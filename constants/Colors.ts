// constants/Colors.ts
// Single source of truth for all colors in Wash Hub.
// Import { Colors } from '@/constants/Colors' — never hardcode hex values.

export const Colors = {
  // ── Core Brand ────────────────────────────────────────────────────────────
  primary:        '#1E2A3A',   // deep slate — main brand color
  primaryDark:    '#141E2B',   // darker slate — headers, nav bars
  primaryLight:   '#2E3E52',   // lighter slate — hover states

  // ── Accent (water/clean feel) ─────────────────────────────────────────────
  accent:         '#2196F3',   // clean blue — CTAs, links, active states
  accentLight:    '#64B5F6',   // light blue — highlights
  accentMuted:    '#BBDEFB',   // very light blue — backgrounds, badges

  // ── Neutrals ─────────────────────────────────────────────────────────────
  background:     '#F4F6F8',   // light gray — app background
  surface:        '#FFFFFF',   // white — cards, modals, inputs
  surfaceAlt:     '#F9FAFB',   // near white — alternate rows, sections

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary:    '#1E2A3A',   // dark slate — headings, main text
  textSecondary:  '#64748B',   // medium slate — subtitles, labels
  textMuted:      '#94A3B8',   // light slate — placeholders, hints
  textInverse:    '#FFFFFF',   // white text — on dark backgrounds

  // ── Borders & Dividers ───────────────────────────────────────────────────
  border:         '#E2E8F0',   // soft gray — input borders, dividers
  borderFocus:    '#2196F3',   // blue — focused input border

  // ── Status Colors ─────────────────────────────────────────────────────────
  success:        '#22C55E',   // green — completed, confirmed
  successBg:      '#DCFCE7',   // light green background
  warning:        '#F59E0B',   // amber — pending, in progress
  warningBg:      '#FEF3C7',   // light amber background
  error:          '#EF4444',   // red — errors, cancelled, delete
  errorBg:        '#FEE2E2',   // light red background
  info:           '#3B82F6',   // blue — info badges
  infoBg:         '#DBEAFE',   // light blue background

  // ── Utility ───────────────────────────────────────────────────────────────
  overlay:        'rgba(0,0,0,0.5)',
  shadow:         '#000000',
  transparent:    'transparent',
  white:          '#FFFFFF',
  black:          '#000000',
} as const;

// ── Semantic aliases — use these in components for clarity ────────────────

export const Theme = {
  // Backgrounds
  screenBg:           Colors.background,
  cardBg:             Colors.surface,
  inputBg:            Colors.surface,
  headerBg:           Colors.primary,
  tabBarBg:           Colors.surface,
  modalBg:            Colors.surface,

  // Text
  headingText:        Colors.textPrimary,
  bodyText:           Colors.textSecondary,
  mutedText:          Colors.textMuted,
  inverseText:        Colors.textInverse,
  linkText:           Colors.accent,
  labelText:          Colors.textSecondary,

  // Buttons
  btnPrimary:         Colors.accent,
  btnPrimaryText:     Colors.white,
  btnSecondary:       Colors.surface,
  btnSecondaryText:   Colors.accent,
  btnDanger:          Colors.error,
  btnDangerText:      Colors.white,
  btnDisabled:        Colors.border,
  btnDisabledText:    Colors.textMuted,

  // Inputs
  inputBorder:        Colors.border,
  inputBorderFocus:   Colors.borderFocus,
  inputText:          Colors.textPrimary,
  inputPlaceholder:   Colors.textMuted,

  // Cards
  cardBorder:         Colors.border,
  cardShadow:         Colors.shadow,

  // Navigation
  activeTab:          Colors.accent,
  inactiveTab:        Colors.textMuted,
} as const;

export default Colors;
