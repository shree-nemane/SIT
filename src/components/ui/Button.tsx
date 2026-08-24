import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, shadows, fonts } from '../../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}) => {
  const isInteractive = !disabled && !isLoading;

  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
    };

    // Size styles
    if (size === 'sm') {
      base.paddingVertical = spacing.xs;
      base.paddingHorizontal = spacing.sm;
      base.borderRadius = 10;
    } else if (size === 'lg') {
      base.paddingVertical = 14;
      base.paddingHorizontal = spacing.xl;
      base.borderRadius = 14;
    } else {
      base.paddingVertical = spacing.sm;
      base.paddingHorizontal = spacing.md;
      base.borderRadius = 14;
    }

    // Variant styles
    switch (variant) {
      case 'primary':
        base.backgroundColor = colors.primary;
        if (size === 'lg') {
          base = { ...base, ...shadows.card };
        }
        break;
      case 'secondary':
        base.backgroundColor = colors.surfaceElevated;
        base.borderWidth = 1;
        base.borderColor = colors.surfaceBorder;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1;
        base.borderColor = colors.primary;
        break;
      case 'destructive':
        base.backgroundColor = colors.syncErrorMuted;
        base.borderWidth = 1;
        base.borderColor = colors.syncError;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
    }

    if (disabled || isLoading) {
      base.opacity = 0.5;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let baseText: TextStyle = {
      fontFamily: size === 'lg' ? fonts.manrope.bold : fonts.manrope.semiBold,
    };

    if (size === 'sm') {
      baseText.fontSize = 12;
    } else if (size === 'lg') {
      baseText.fontSize = 16;
    } else {
      baseText.fontSize = 14;
    }

    switch (variant) {
      case 'primary':
        baseText.color = colors.textInverse;
        break;
      case 'secondary':
        baseText.color = colors.textPrimary;
        break;
      case 'outline':
        baseText.color = colors.primary;
        break;
      case 'destructive':
        baseText.color = colors.syncError;
        break;
      case 'ghost':
        baseText.color = colors.textSecondary;
        break;
    }

    return baseText;
  };

  const spinnerColor =
    variant === 'primary'
      ? colors.textInverse
      : variant === 'destructive'
      ? colors.syncError
      : colors.primary;

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text style={[getTextStyle(), leftIcon ? styles.leftMargin : null, rightIcon ? styles.rightMargin : null, textStyle]}>
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  leftMargin: {
    marginLeft: spacing.xs,
  },
  rightMargin: {
    marginRight: spacing.xs,
  },
});

export default Button;
