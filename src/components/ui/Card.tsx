import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, shadows } from '../../theme/theme';

export type CardVariant = 'default' | 'elevated' | 'highlighted' | 'interactive';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  onPress,
  style,
}) => {
  const getCardStyle = (): ViewStyle => {
    let base: ViewStyle = {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    };

    if (variant === 'elevated') {
      base.backgroundColor = colors.surfaceElevated;
      base.borderColor = colors.surfaceBorder;
    } else if (variant === 'highlighted') {
      base.backgroundColor = colors.surfaceElevated;
      base.borderColor = colors.surfaceBorderLight;
    } else if (variant === 'interactive') {
      base.backgroundColor = colors.surfaceElevated;
      base.borderColor = colors.surfaceBorder;
    }

    return base;
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[getCardStyle(), style]}>{children}</View>;
};

export default Card;
