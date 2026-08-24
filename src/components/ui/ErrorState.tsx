import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import Text from './Text';
import { colors, spacing, borderRadius } from '../../theme/theme';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  safeMessage?: string;
  onRetry?: () => void;
  retryText?: string;
}

/**
 * ErrorState Component (Law 19)
 * Clean, dignified error messages that:
 * 1. Name what failed
 * 2. Name what remains safe
 * 3. Offer a clean retry action
 * Never uses blaming or obscure tech language like "Invalid request" / "Operation failed".
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Connection problem',
  message = 'We could not connect to sync your circle data.',
  safeMessage = 'Your current local status is saved and safe.',
  onRetry,
  retryText = 'Try Again',
}) => {
  return (
    <View style={styles.container}>
      <Text variant="subtitle" style={styles.titleText}>{title}</Text>
      <Text variant="bodySmall" style={styles.messageText}>{message}</Text>
      {safeMessage ? (
        <Text variant="micro" style={styles.safeText}>✓ {safeMessage}</Text>
      ) : null}

      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text variant="label" style={styles.retryBtnText}>{retryText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  titleText: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  messageText: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  safeText: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  retryBtn: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.surfaceBorderLight,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xxs,
  },
  retryBtnText: {
    color: colors.textPrimary,
  },
});

export default ErrorState;
