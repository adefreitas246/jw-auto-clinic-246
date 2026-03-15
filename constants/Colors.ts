// constants/Colors.ts
// Single source of truth for all colors in Wash Hub.
// Import { Colors } from '@/constants/Colors' — never hardcode hex values.

export const Colors = {

  // ── Brand ────────────────────────────────────────────────────────
  primary:          '#0A1628',   // deep navy black — main brand, headers
  primaryDark:      '#060E1A',   // near black — status bar, dark surfaces
  primaryLight:     '#162236',   // dark navy — secondary headers, nav

  // ── Accent (water blue — clean, fresh, professional) ─────────────
  accent:           '#0EA5E9',   // sky blue — CTAs, active states, links
  accentDark:       '#0284C7',   // deep sky blue — pressed states
  accentLight:      '#38BDF8',   // light sky blue — highlights
  accentMuted:      '#E0F2FE',   // very light blue — badge backgrounds

  // ── Neutrals (wet asphalt + clean foam) ──────────────────────────
  background:       '#F8F9FA',   // near white — app background
  surface:          '#FFFFFF',   // pure white — cards, modals, inputs
  surfaceAlt:       '#F1F3F5',   // light gray — alternate rows, sections
  surfaceRaised:    '#FFFFFF',   // white — elevated cards

  // ── Text ─────────────────────────────────────────────────────────
  textPrimary:      '#0A1628',   // deep navy — headings, main text
  textSecondary:    '#4B5563',   // medium gray — subtitles, body
  textMuted:        '#9CA3AF',   // light gray — placeholders, hints
  textInverse:      '#FFFFFF',   // white — text on dark backgrounds
  textAccent:       '#0EA5E9',   // sky blue — links, active labels

  // ── Borders & Dividers ───────────────────────────────────────────
  border:           '#E5E7EB',   // soft gray — input borders, dividers
  borderFocus:      '#0EA5E9',   // sky blue — focused input border
  borderStrong:     '#D1D5DB',   // medium gray — prominent dividers

  // ── Status ───────────────────────────────────────────────────────
  success:          '#16A34A',   // forest green — completed, confirmed
  successBg:        '#DCFCE7',   // light green — success badge background
  successText:      '#15803D',   // dark green — success badge text

  warning:          '#D97706',   // amber — pending, in progress, caution
  warningBg:        '#FEF3C7',   // light amber — warning badge background
  warningText:      '#B45309',   // dark amber — warning badge text

  error:            '#DC2626',   // red — errors, cancelled, delete
  errorBg:          '#FEE2E2',   // light red — error badge background
  errorText:        '#B91C1C',   // dark red — error badge text

  info:             '#0EA5E9',   // sky blue — info states
  infoBg:           '#E0F2FE',   // light blue — info badge background
  infoText:         '#0284C7',   // deep blue — info badge text

  // ── Chrome / Metallic (detailing aesthetic) ──────────────────────
  chrome:           '#CBD5E1',   // silver — metallic accents
  chromeDark:       '#94A3B8',   // dark silver — secondary metallic
  chromeLight:      '#F1F5F9',   // near white silver — subtle highlights

  // ── Utility ──────────────────────────────────────────────────────
  overlay:          'rgba(10,22,40,0.6)',
  shadow:           '#0A1628',
  transparent:      'transparent',
  white:            '#FFFFFF',
  black:            '#000000',
} as const;

// ── Semantic Theme Aliases ─────────────────────────────────────────
export const Theme = {
  // Screens
  screenBg:         Colors.background,
  cardBg:           Colors.surface,
  cardBgAlt:        Colors.surfaceAlt,
  inputBg:          Colors.surface,

  // Navigation
  headerBg:         Colors.primary,
  headerText:       Colors.textInverse,
  tabBarBg:         Colors.surface,
  tabBarBorder:     Colors.border,
  tabActive:        Colors.accent,
  tabInactive:      Colors.textMuted,

  // Buttons
  btnPrimary:       Colors.accent,
  btnPrimaryText:   Colors.white,
  btnPrimaryPress:  Colors.accentDark,
  btnSecondary:     Colors.surface,
  btnSecondaryText: Colors.accent,
  btnSecondaryBorder: Colors.accent,
  btnDanger:        Colors.error,
  btnDangerText:    Colors.white,
  btnDisabled:      Colors.surfaceAlt,
  btnDisabledText:  Colors.textMuted,

  // Inputs
  inputBorder:      Colors.border,
  inputBorderFocus: Colors.borderFocus,
  inputText:        Colors.textPrimary,
  inputPlaceholder: Colors.textMuted,
  inputLabel:       Colors.textSecondary,

  // Cards
  cardBorder:       Colors.border,
  cardShadowColor:  Colors.shadow,

  // Badges
  badgeSuccess:     Colors.successBg,
  badgeSuccessText: Colors.successText,
  badgeWarning:     Colors.warningBg,
  badgeWarningText: Colors.warningText,
  badgeError:       Colors.errorBg,
  badgeErrorText:   Colors.errorText,
  badgeInfo:        Colors.infoBg,
  badgeInfoText:    Colors.infoText,
} as const;

export default Colors;
