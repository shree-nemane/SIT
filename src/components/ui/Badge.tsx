import React from 'react';
import { Text, View, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme/theme';

export type BadgeVariant = 'you' | 'owner' | 'group' | 'pending' | 'success' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
}) => {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.round,
      alignSelf: 'flex-start',
    };

    switch (variant) {
      case 'you':
        base.backgroundColor = colors.primary;
        break;
      case 'owner':
        base.backgroundColor = colors.primaryMuted;
        base.borderColor = colors.primary;
        base.borderWidth = 1;
        break;
      case 'group':
        base.backgroundColor = colors.surfaceElevated;
        base.borderColor = colors.surfaceBorder;
        base.borderWidth = 1;
        break;
      case 'pending':
        base.backgroundColor = colors.primaryMuted;
        break;
      case 'success':
        base.backgroundColor = colors.secondaryMuted;
        break;
      case 'neutral':
      default:
        base.backgroundColor = colors.surfaceElevated;
        break;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let baseText: TextStyle = {
      fontSize: typography.fontSizes.xxs,
      fontWeight: typography.weights.bold,
    };

    switch (variant) {
      case 'you':
        baseText.color = colors.textInverse;
        break;
      case 'owner':
      case 'pending':
        baseText.color = colors.primary;
        break;
      case 'group':
      case 'success':
        baseText.color = colors.secondary;
        break;
      case 'neutral':
      default:
        baseText.color = colors.textSecondary;
        break;
    }

    return baseText;
  };

  return (
    <View style={[getContainerStyle(), style]}>
      <Text style={[getTextStyle(), textStyle]}>{label}</Text>
    </View>
  );
};

export default Badge;
