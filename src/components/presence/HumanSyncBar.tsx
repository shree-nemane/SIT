import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '../../theme/theme';

export interface HumanSyncBarProps {
  status?: 'synced' | 'pending' | 'syncing' | 'offline';
}

export const HumanSyncBar: React.FC<HumanSyncBarProps> = ({ status = 'synced' }) => {
  if (status === 'synced') return null;

  let text = '';
  let color: string = colors.textMuted;

  switch (status) {
    case 'pending':
      text = 'Saved locally · Syncs online';
      color = colors.syncPending;
      break;
    case 'syncing':
      text = '↻ Syncing with your circle...';
      color = colors.primary;
      break;
    case 'offline':
      text = '● Offline';
      color = colors.textMuted;
      break;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.medium,
  },
});

export default HumanSyncBar;
