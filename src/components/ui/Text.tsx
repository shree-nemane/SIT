import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors } from '../../theme/theme';
import { typography, TypographyVariant } from '../../theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  children?: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color,
  style,
  children,
  allowFontScaling = true,
  ...props
}) => {
  const variantStyle = typography[variant] || typography.body;
  const textColor = color || colors.textPrimary;

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      style={[styles.base, variantStyle, { color: textColor }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});

export default Text;
