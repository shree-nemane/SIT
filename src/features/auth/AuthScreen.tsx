import React from 'react';
import { StyleSheet, Text, View, Linking } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, spacing, typography, borderRadius } from '../../theme/theme';
import { useAuthStore } from './authStore';
import { api } from '../../data/api';

export const AuthScreen: React.FC = () => {
  const { isLoading, error, setError } = useAuthStore();

  const handleGoogleSignIn = async () => {
    setError(null);
    const res = await api.signInWithGoogle();
    if (res.error) {
      setError(res.error);
    } else if (res.url) {
      Linking.openURL(res.url);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SIT</Text>
        </View>
        <Text style={styles.brandTitle}>Stay in Touch</Text>
        <Text style={styles.brandTagline}>
          A private, quiet window into the everyday lives of your closest circle.
        </Text>
      </View>

      <Card variant="elevated" style={styles.cardContent}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          title="Continue with Google"
          onPress={handleGoogleSignIn}
          variant="primary"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading}
        />

        <Text style={styles.footerNote}>
          Private & invite-only · Free for your circle
        </Text>
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  brandContainer: {
    marginTop: spacing.xxl,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: colors.primary,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.weights.heavy,
    letterSpacing: 1,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.display,
    fontWeight: typography.weights.heavy,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  brandTagline: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.md,
    marginTop: spacing.xs,
    lineHeight: 28,
  },
  cardContent: {
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.syncErrorMuted,
    borderColor: colors.syncError,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.syncError,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  footerNote: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default AuthScreen;
