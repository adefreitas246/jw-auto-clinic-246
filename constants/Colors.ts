// constants/Colors.ts
// Central design token file for Wash Hub.
// Import Colors from here instead of using hardcoded hex values.

export const Colors = {
  // ── Brand ────────────────────────────────────────────────────────────────
  primary:       '#1A1A2E',  // deep navy — trust, professionalism
  secondary:     '#16213E',  // darker navy — depth
  accent:        '#0F9B8E',  // teal — clean, water, freshness
  accentLight:   '#14C6B5',  // light teal — highlights, CTAs

  // ── Surfaces ─────────────────────────────────────────────────────────────
  background:    '#F5F7FA',  // off-white — clean, airy
  surface:       '#FFFFFF',  // pure white — cards, modals

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary:   '#1A1A2E',  // dark navy — main text
  textSecondary: '#6B7280',  // medium gray — subtitles, labels
  textMuted:     '#9CA3AF',  // light gray — placeholders, hints

  // ── UI ───────────────────────────────────────────────────────────────────
  border:        '#E5E7EB',  // very light gray — dividers, inputs
  overlay:       'rgba(26,26,46,0.6)',

  // ── Semantic ─────────────────────────────────────────────────────────────
  success:       '#10B981',  // green — completed jobs, confirmations
  warning:       '#F59E0B',  // amber — pending, caution
  error:         '#EF4444',  // red — errors, cancellations

  // ── Utilities ────────────────────────────────────────────────────────────
  white:         '#FFFFFF',
  black:         '#000000',
} as const;

// ── Status badge helpers ──────────────────────────────────────────────────

export const StatusColors = {
  completed:  { bg: '#D1FAE5', text: '#10B981' },
  active:     { bg: '#D1FAE5', text: '#10B981' },
  pending:    { bg: '#FEF3C7', text: '#F59E0B' },
  warning:    { bg: '#FEF3C7', text: '#F59E0B' },
  cancelled:  { bg: '#FEE2E2', text: '#EF4444' },
  error:      { bg: '#FEE2E2', text: '#EF4444' },
  inProgress: { bg: '#DBEAFE', text: '#3B82F6' },
} as const;

// ── Accent-tinted icon backgrounds ───────────────────────────────────────

export const IconBg = {
  teal:   '#E6FAF8',
  navy:   '#E8EAF2',
  green:  '#ECFDF5',
  amber:  '#FFFBEB',
  blue:   '#EFF6FF',
  red:    '#FEF2F2',
} as const;
