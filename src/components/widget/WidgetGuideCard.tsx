import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { colors, spacing, typography } from '../../theme/theme';

export const WidgetGuideCard: React.FC = () => {
  const steps = [
    "Go to your Phone's Home Screen.",
    'Long-press on any empty space.',
    'Tap Widgets from the menu.',
    'Locate Stay in Touch (SIT).',
    'Drag the widget onto your Home Screen!',
  ];

  return (
    <Card variant="default" style={styles.card}>
      <Text style={styles.headerTitle}>📱 ANDROID HOME SCREEN WIDGET</Text>
      <Text style={styles.headerSub}>
        Keep your close circle right on your Android Home Screen.
      </Text>

      <View style={styles.stepsList}>
        {steps.map((step, idx) => (
          <View key={idx} style={styles.stepItem}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{idx + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  headerSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    lineHeight: typography.lineHeights.sm,
    marginBottom: spacing.md,
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.bold,
  },
  stepText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xs,
    flex: 1,
  },
});

export default WidgetGuideCard;
