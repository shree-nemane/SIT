/**
 * Stay in Touch (SIT) Theme Tokens
 * Visual Philosophy: Warm, Intimate, Modern, Slightly Playful, Premium.
 * Rule: "The UI should feel designed, not decorated."
 */

export const colors = {
  // 5-Layer Warm Neutral Surface System
  background: '#121212',         // Layer 0: Warm charcoal foundation
  surface: '#1E1E1E',            // Layer 1: Content cards & standard containers
  surfaceElevated: '#252525',    // Layer 2: Interactive elements, hover cards, modals
  surfaceHighlight: '#2E2E2E',   // Layer 3: Featured / active item highlight
  surfaceOverlay: '#383838',     // Layer 4: Tooltips & popover controls
  surfaceBorder: '#2A2A2A',      // Subtle border stroke (used sparingly)
  surfaceBorderLight: '#3A3A3A', // Active / focus border stroke
  surfaceAmber: '#241D12',       // Solid rich dark amber surface for highlighted cards

  // Accent Colors (Warm Amber & Soft Mint)
  primary: '#F59E0B',            // Warm Amber CTA & Active highlights
  primaryDark: '#D97706',
  primaryLight: '#FBBF24',
  primaryMuted: 'rgba(245, 158, 11, 0.12)',

  secondary: '#10B981',          // Soft Mint — semantic: online, synced, success
  secondaryDark: '#059669',
  secondaryMuted: 'rgba(16, 185, 129, 0.12)',

  // Text & Typography Hierarchy
  textPrimary: '#F3F4F6',        // Main titles, active body text
  textSecondary: '#9CA3AF',      // Subtitles, helper text
  textMuted: '#6B7280',          // Captions, timestamps, disabled indicators
  textInverse: '#121212',        // Text over amber buttons

  // Status & Feedback Indicators
  syncSuccess: '#10B981',
  syncPending: '#F59E0B',
  syncError: '#EF4444',
  syncErrorMuted: 'rgba(239, 68, 68, 0.12)',

  // Dividers & Overlay Shadows
  divider: '#1F2937',
  overlay: 'rgba(18, 18, 18, 0.85)',
  cardShadow: 'rgba(0, 0, 0, 0.3)',
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  fab: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSizes: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
    code: 26,
  },
  lineHeights: {
    xxs: 14,
    xs: 16,
    sm: 20,
    md: 24,
    lg: 26,
    xl: 30,
    xxl: 36,
    display: 42,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const motion = {
  fast: 150,
  normal: 250,
};

export const QUICK_STATUSES = [
  { label: 'Coffee break', emoji: '☕' },
  { label: 'Deep work', emoji: '💻' },
  { label: 'On the move', emoji: '🚗' },
  { label: 'At the gym', emoji: '🏋️' },
  { label: 'Chilling', emoji: '🎧' },
];

export const theme = {
  colors,
  shadows,
  typography,
  spacing,
  borderRadius,
  motion,
  QUICK_STATUSES,
};

export default theme;
