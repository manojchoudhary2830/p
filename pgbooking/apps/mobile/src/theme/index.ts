import { Platform, TextStyle, ViewStyle } from 'react-native';

// ─────────────────────────────────────────────
// Color Tokens (from UI/UX Brief)
// ─────────────────────────────────────────────

export const Colors = {
  // Brand
  primary: '#1E3A8A',      // Deep Indigo — headers, CTAs, selection
  primaryLight: '#2563EB',
  primaryDark: '#1E2D5A',
  secondary: '#0D9488',    // Teal — action buttons, filter chips, confirmation
  secondaryLight: '#14B8A6',
  secondaryDark: '#0F766E',

  // Semantic
  error: '#DC2626',        // Crimson — errors, booking conflicts
  errorLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  success: '#16A34A',
  successLight: '#DCFCE7',
  info: '#0369A1',
  infoLight: '#E0F2FE',

  // Neutrals
  text: {
    primary: '#0F172A',    // slate-900
    secondary: '#475569',  // slate-600 — body text per brief (tracking 0, soft charcoal)
    tertiary: '#94A3B8',   // slate-400
    inverse: '#FFFFFF',
    link: '#1E3A8A',
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',  // slate-50
    tertiary: '#F1F5F9',   // slate-100
    elevated: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.5)',
  },
  border: {
    light: '#E2E8F0',      // slate-200
    default: '#CBD5E1',    // slate-300 — occupied bed color
    strong: '#94A3B8',
  },
  surface: {
    card: '#FFFFFF',
    modal: '#FFFFFF',
    input: '#F8FAFC',
  },

  // Bed Status Colors (from UX brief)
  bed: {
    vacant: '#FFFFFF',       // Available — white background
    reserved: '#FEF3C7',     // Pending — amber tint
    occupied: '#CBD5E1',     // Occupied — static grey per brief
    selected: '#EFF6FF',     // Selected — light indigo with teal ring
  },
} as const;

// Dark mode overrides
export const DarkColors = {
  ...Colors,
  background: {
    primary: '#0F172A',
    secondary: '#1E293B',
    tertiary: '#334155',
    elevated: '#1E293B',
    overlay: 'rgba(0,0,0,0.7)',
  },
  surface: {
    card: '#1E293B',
    modal: '#1E293B',
    input: '#334155',
  },
  border: {
    light: '#334155',
    default: '#475569',
    strong: '#64748B',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    inverse: '#0F172A',
    link: '#60A5FA',
  },
} as const;

// ─────────────────────────────────────────────
// Typography (Inter font system per brief)
// ─────────────────────────────────────────────

const FONT_FAMILY = Platform.select({
  ios: 'Inter',
  android: 'Inter',
});

export const Typography = {
  // H1: 22pt bold, tracking -0.02ct (per brief)
  h1: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.44, // -0.02 * 22
    color: Colors.text.primary,
    lineHeight: 30,
  } as TextStyle,

  // H2: 14pt semi-bold (per brief)
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.text.primary,
    lineHeight: 20,
  } as TextStyle,

  h3: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.text.primary,
    lineHeight: 26,
  } as TextStyle,

  h4: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.text.primary,
    lineHeight: 24,
  } as TextStyle,

  // Body: 10.5pt regular, tracking 0 (per brief)
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 14, // using 14pt as 10.5 is too small for mobile
    fontWeight: '400' as TextStyle['fontWeight'],
    letterSpacing: 0,
    color: Colors.text.secondary,
    lineHeight: 22,
  } as TextStyle,

  bodySmall: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.text.secondary,
    lineHeight: 18,
  } as TextStyle,

  caption: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.text.tertiary,
    lineHeight: 16,
  } as TextStyle,

  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '500' as TextStyle['fontWeight'],
    color: Colors.text.primary,
    lineHeight: 18,
  } as TextStyle,

  button: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.1,
  } as TextStyle,

  price: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: '700' as TextStyle['fontWeight'],
    color: Colors.primary,
  } as TextStyle,
} as const;

// ─────────────────────────────────────────────
// Spacing Scale (8pt grid)
// ─────────────────────────────────────────────

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
  screen: 16,  // standard horizontal screen padding
} as const;

// ─────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────

export const Radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────
// Shadows
// ─────────────────────────────────────────────

export const Shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    android: { elevation: 4 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 8 },
  }),
} as const;

// ─────────────────────────────────────────────
// Animation Durations
// ─────────────────────────────────────────────

export const Duration = {
  fast:   150,
  normal: 250,
  slow:   400,
} as const;

// ─────────────────────────────────────────────
// Z-Index Stack
// ─────────────────────────────────────────────

export const ZIndex = {
  base:    0,
  card:    1,
  overlay: 10,
  modal:   20,
  toast:   30,
} as const;
