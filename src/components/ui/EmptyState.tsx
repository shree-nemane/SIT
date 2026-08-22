import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, shadows, typography } from '../../theme/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <View style={styles.iconWrapper}>{icon}</View>
      ) : (
        <View style={styles.defaultIconBadge}>
          <Text style={styles.defaultIconText}>✨</Text>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 0,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  iconWrapper: {
    marginBottom: spacing.sm,
  },
  defaultIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  defaultIconText: {
    fontSize: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionBtn: {
    marginTop: spacing.md,
  },
});

export default EmptyState;
