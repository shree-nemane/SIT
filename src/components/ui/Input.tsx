import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, fonts } from '../../theme/theme';
import Text from './Text';

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
      return { borderColor: colors.surfaceBorderLight, borderWidth: 1 };
    }
    return { borderColor: colors.surfaceBorder, borderWidth: 1 };
  };

  const counterThreshold = maxLength !== undefined ? (maxLength > 30 ? maxLength - 30 : Math.floor(maxLength * 0.7)) : 0;
  const showCounter = maxLength !== undefined && value.length >= counterThreshold;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text variant="label" style={styles.label}>{label}</Text>}

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
          <Text variant="micro" style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.flexOne} />
        )}
        {showCounter && (
          <Text variant="micro" style={styles.counterText}>
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
    fontFamily: fonts.manrope.regular,
    fontSize: 16,
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
  },
  counterText: {
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  flexOne: {
    flex: 1,
  },
});

export default Input;
