import { TextStyle } from 'react-native';
import { fonts } from './fonts';

/**
 * Stay in Touch (SIT) Semantic Typography Presets
 * Each preset defines fontFamily, fontSize, lineHeight, and optional letterSpacing.
 */

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'subtitle'
  | 'body'
  | 'bodySmall'
  | 'label'
  | 'micro'
  | 'note';

export const typographyVariants: Record<TypographyVariant, TextStyle> = {
  display: {
    fontFamily: fonts.manrope.extraBold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fonts.manrope.bold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fonts.manrope.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fonts.manrope.semiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fonts.manrope.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fonts.manrope.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fonts.manrope.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: fonts.manrope.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  micro: {
    fontFamily: fonts.manrope.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  note: {
    fontFamily: fonts.caveat.medium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0.1,
  },
};

export const typography = Object.assign({}, typographyVariants, {
  fontFamily: {
    regular: fonts.manrope.regular,
    medium: fonts.manrope.medium,
    bold: fonts.manrope.bold,
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
});

export default typography;
