import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, typography } from '../../theme/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  maxLength,
  value = '',
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const getInputBorderStyle = (): ViewStyle => {
    if (error) {
      return { borderColor: colors.syncError, borderWidth: 1 };
    }
    if (isFocused) {
      return { borderColor: colors.primary, borderWidth: 1.5 };
    }
    return { borderColor: colors.surfaceBorder, borderWidth: 1 };
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputContainer, getInputBorderStyle()]}>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.textMuted}
          value={value}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
      </View>

      <View style={styles.footerRow}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.flexOne} />
        )}
        {maxLength !== undefined && (
          <Text style={styles.counterText}>
            {value.length} / {maxLength}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    width: '100%',
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.md,
    padding: 0,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.syncError,
    fontSize: typography.fontSizes.xs,
  },
  counterText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    marginLeft: 'auto',
  },
  flexOne: {
    flex: 1,
  },
});

export default Input;
