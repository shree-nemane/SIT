import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme/theme';

export const SplashScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stay in Touch</Text>
        <Text style={styles.tagline}>Simple enough to disappear.</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: typography.fontSizes.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    height: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SplashScreen;
