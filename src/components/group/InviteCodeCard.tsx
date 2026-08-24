import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { colors, spacing, typography, borderRadius } from '../../theme/theme';

export interface InviteCodeCardProps {
  code: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error?: string | null;
  onCopy: () => void;
  onGenerateNew: () => void;
}

const formatInviteExpiration = (expiresAtStr: string | null): string => {
  if (!expiresAtStr) return 'Valid for 24 hours';
  const expDate = new Date(expiresAtStr);
  if (isNaN(expDate.getTime())) return 'Valid for 24 hours';

  const timeStr = expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = new Date().toDateString() === expDate.toDateString();
  return isToday
    ? `Expires today at ${timeStr}`
    : `Expires ${expDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

export const InviteCodeCard: React.FC<InviteCodeCardProps> = ({
  code,
  expiresAt,
  isLoading,
  error,
  onCopy,
  onGenerateNew,
}) => {
  return (
    <Card variant="elevated" style={styles.card}>
      <Text style={styles.sectionTitle}>GROUP INVITATION CODE</Text>
      <Text style={styles.sectionSub}>
        Share this 6-character code with a close friend to invite them into your circle.
      </Text>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Checking invitation status...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : code ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.expiryText}>⏳ {formatInviteExpiration(expiresAt)}</Text>

          <View style={styles.btnRow}>
            <Button
              title="📋 Copy Code"
              onPress={onCopy}
              variant="primary"
              size="sm"
              style={styles.flexOne}
              disabled={isLoading}
            />
            <Button
              title="↻ New Code"
              onPress={onGenerateNew}
              variant="secondary"
              size="sm"
              style={styles.flexOne}
              disabled={isLoading}
            />
          </View>
        </View>
      ) : (
        <View style={styles.noCodeBox}>
          <Text style={styles.noCodeText}>
            No active invitation code. Create a 24-hour invite code to invite a friend to your circle.
          </Text>
          <Button
            title="➕ Create Invite Code"
            onPress={onGenerateNew}
            variant="primary"
            size="sm"
            disabled={isLoading}
          />
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  sectionSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    lineHeight: typography.lineHeights.sm,
    marginBottom: spacing.md,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
  },
  errorBox: {
    backgroundColor: colors.syncErrorMuted,
    borderColor: colors.syncError,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  errorText: {
    color: colors.syncError,
    fontSize: typography.fontSizes.xs,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  codeText: {
    color: colors.primary,
    fontSize: typography.fontSizes.code,
    fontWeight: typography.weights.heavy,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  expiryText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    marginBottom: spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  flexOne: {
    flex: 1,
  },
  noCodeBox: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  noCodeText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.sm,
  },
});

export default InviteCodeCard;
