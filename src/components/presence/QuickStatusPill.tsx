import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, typography, QUICK_STATUSES } from '../../theme/theme';

export interface QuickStatusPillProps {
  onSelectStatus: (text: string) => void;
  disabled?: boolean;
}

export const QuickStatusPill: React.FC<QuickStatusPillProps> = ({ onSelectStatus, disabled = false }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>QUICK STATUS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {QUICK_STATUSES.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.pill, disabled && styles.pillDisabled]}
            onPress={() => onSelectStatus(`${item.label} ${item.emoji}`)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text style={styles.emojiText}>{item.emoji}</Text>
            <Text style={styles.pillText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  headerLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  scrollRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.round,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  emojiText: {
    fontSize: typography.fontSizes.sm,
    marginRight: spacing.xs,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.medium,
  },
});

export default QuickStatusPill;
