/**
 * Stay in Touch (SIT) Font Family Mappings
 * Manrope -> UI structure, navigation, buttons, headers, body, names, forms
 * Caveat -> Limited emotional expression (presence captions, polaroid notes, status updates)
 */

export const fonts = {
  manrope: {
    regular: 'Manrope-Regular',
    medium: 'Manrope-Medium',
    semiBold: 'Manrope-SemiBold',
    bold: 'Manrope-Bold',
    extraBold: 'Manrope-ExtraBold',
  },
  caveat: {
    regular: 'Caveat-Regular',
    medium: 'Caveat-Medium',
    bold: 'Caveat-Bold',
  },
} as const;

export type FontFamilyKey = keyof typeof fonts;
export default fonts;
