import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/theme';
import { useAuthStore } from './authStore';

export const JoinGroupScreen: React.FC = () => {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [invitationCode, setInvitationCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { joinGroup, createGroup, signOut, isLoading, error, setError } = useAuthStore();

  const handleSubmit = async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'join') {
      if (!invitationCode.trim()) {
        setError('Please enter the 6-character invitation code.');
        return;
      }
      if (invitationCode.trim().length !== 6) {
        setError('Invitation code must be exactly 6 characters.');
        return;
      }
      await joinGroup(invitationCode.trim(), displayName.trim());
    } else {
      if (!groupName.trim()) {
        setError('Please enter a group name.');
        return;
      }
      await createGroup(groupName.trim(), displayName.trim());
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} keyboardAvoiding scrollable style={styles.container}>
      <View style={styles.padding}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === 'join' ? 'Join Private Circle' : 'Create Private Circle'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'join'
              ? 'Enter the 6-character invitation code provided by your circle owner.'
              : 'Set up your private circle as the owner and invite your friends.'}
          </Text>
        </View>

        {/* Mode Selector Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'join' && styles.activeTab]}
            onPress={() => {
              setMode('join');
              setError(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'join' && styles.activeTabText]}>
              Join Circle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'create' && styles.activeTab]}
            onPress={() => {
              setMode('create');
              setError(null);
            }}
          >
            <Text style={[styles.tabText, mode === 'create' && styles.activeTabText]}>
              Create Circle
            </Text>
          </TouchableOpacity>
        </View>

        <Card variant="elevated" style={styles.formCard}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Your Display Name"
            placeholder="e.g. Alex"
            value={displayName}
            onChangeText={setDisplayName}
          />

          {mode === 'create' ? (
            <Input
              label="Circle Name"
              placeholder="e.g. Close Circle"
              value={groupName}
              onChangeText={setGroupName}
            />
          ) : (
            <Input
              label="6-Character Invitation Code"
              placeholder="e.g. SIT202"
              autoCapitalize="characters"
              maxLength={6}
              value={invitationCode}
              onChangeText={setInvitationCode}
              inputStyle={styles.codeInput}
            />
          )}

          <Button
            title={mode === 'join' ? 'Join Circle' : 'Create Circle'}
            onPress={handleSubmit}
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading || !displayName.trim()}
            style={styles.submitButton}
          />

          <Button
            title="Sign Out"
            onPress={signOut}
            variant="ghost"
            size="sm"
            style={styles.signOutBtn}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  padding: {
    paddingVertical: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    marginTop: spacing.xs,
    lineHeight: typography.lineHeights.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 0,
    ...shadows.card,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs + 4,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.weights.semibold,
  },
  activeTabText: {
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  formCard: {
    padding: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.syncErrorMuted,
    borderColor: colors.syncError,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.syncError,
    fontSize: typography.fontSizes.xs,
    textAlign: 'center',
  },
  codeInput: {
    letterSpacing: 3,
    fontWeight: typography.weights.bold,
    fontSize: typography.fontSizes.lg,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  signOutBtn: {
    marginTop: spacing.sm,
  },
});

export default JoinGroupScreen;
