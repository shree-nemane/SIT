import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  NativeModules,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MemberRow } from '../../components/group/MemberRow';
import { InviteCodeCard } from '../../components/group/InviteCodeCard';
import Text from '../../components/ui/Text';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import MemberRepository, { GroupDetailInfo } from '../../data/repositories/MemberRepository';
import { api } from '../../data/api';
import syncEngine from '../sync/syncEngine';

export const GroupScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { member, groupName, userId } = useAuthStore();
  const [groupDetails, setGroupDetails] = useState<GroupDetailInfo | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Progressive Disclosure State for Invite Admin (Law 10)
  const [inviteAdminExpanded, setInviteAdminExpanded] = useState(false);

  // Invitation state
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const activeGroupId = member?.groupId;
  const activeUserId = member?.id || userId;

  const loadGroupDetails = useCallback(async () => {
    if (activeGroupId) {
      const info = await MemberRepository.getGroupInfoAndMembers(activeGroupId);
      setGroupDetails(info);
    }
    setIsLoadingDetails(false);
  }, [activeGroupId]);

  const fetchActiveInvite = useCallback(async () => {
    setIsGeneratingCode(true);
    setInviteError(null);

    try {
      const activeRes = await api.getActiveInvitation();
      if (activeRes.success && activeRes.code) {
        setGeneratedCode(activeRes.code);
        setInviteExpiresAt(activeRes.expiresAt || null);
      } else {
        setGeneratedCode(null);
        setInviteExpiresAt(null);
      }
    } catch (e: any) {
      setInviteError(e?.message || 'Failed to check active invitation status');
      setGeneratedCode(null);
      setInviteExpiresAt(null);
    } finally {
      setIsGeneratingCode(false);
    }
  }, []);

  const generateRandom6Char = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerateInvite = async () => {
    if (isGeneratingCode) return;
    setIsGeneratingCode(true);
    setInviteError(null);

    try {
      const code = generateRandom6Char();
      const res = await api.generateInvitation(code);
      if (res.success && res.code) {
        setGeneratedCode(res.code);
        setInviteExpiresAt(res.expiresAt || null);
      } else {
        setInviteError(res.error || 'Failed to generate invitation code');
      }
    } catch (err: any) {
      setInviteError(err?.message || 'Network error generating code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await syncEngine.syncAll();
    await loadGroupDetails();
    await fetchActiveInvite();
    setIsRefreshing(false);
  }, [loadGroupDetails, fetchActiveInvite]);

  useEffect(() => {
    loadGroupDetails();
    fetchActiveInvite();

    const unsubscribeSync = syncEngine.subscribe(() => {
      loadGroupDetails();
    });

    return () => {
      unsubscribeSync();
    };
  }, [loadGroupDetails, fetchActiveInvite]);

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      const Clipboard = NativeModules.Clipboard || NativeModules.ClipboardModule;
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(generatedCode);
        Alert.alert('Copied!', 'Invitation code copied to clipboard.');
      } else {
        Alert.alert(
          'Invitation Code',
          `Your invitation code is: ${generatedCode}\n\n(Automatic clipboard copying is unavailable on this device.)`
        );
      }
    } catch {
      Alert.alert(
        'Invitation Code',
        `Your invitation code is: ${generatedCode}\n\n(Automatic clipboard copying is unavailable on this device.)`
      );
    }
  };

  const isOwner = groupDetails ? groupDetails.ownerId === activeUserId : false;
  const memberCount = groupDetails?.members.length || 1;

  return (
    <ScreenContainer
      edges={['top']}
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.padding}>
        {/* EYEBROW PAGE HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text variant="micro" style={styles.eyebrowTitle}>CIRCLE</Text>
            <Text variant="h2" style={styles.groupTitle}>{groupDetails?.name || groupName || 'Private Circle'}</Text>
          </View>
        </View>

        {/* FIRST-RUN ONBOARDING FOR SINGLE MEMBER CIRCLES (LAW 18: EXPLAIN EMPTINESS) */}
        {memberCount <= 1 && (
          <Card variant="default" style={styles.onboardingCard}>
            <Text variant="subtitle" style={styles.onboardingTitle}>Welcome to your Circle</Text>
            <Text variant="bodySmall" style={styles.onboardingSub}>
              A circle is a private, encrypted space shared only with your closest people. Invite family or close friends to start staying in touch.
            </Text>
          </Card>
        )}

        {/* MEMBER LIST SECTION (PRIMARY VISUAL ANCHOR) */}
        <View style={styles.membersSection}>
          <Text variant="micro" style={styles.sectionTitle}>CIRCLE MEMBERS ({memberCount})</Text>

          {isLoadingDetails ? (
            <ActivityIndicator color={colors.primary} style={styles.loaderStyle} />
          ) : groupDetails && groupDetails.members.length > 0 ? (
            groupDetails.members.map((m) => (
              <MemberRow
                key={m.id}
                id={m.id}
                displayName={m.displayName}
                profileImageLocalPath={m.profileImageLocalPath}
                isOwner={m.isOwner}
                joinedAt={m.joinedAt}
                isMe={m.id === activeUserId}
                onPress={() => navigation.navigate('MemberDetail', { memberId: m.id })}
              />
            ))
          ) : (
            <Text variant="bodySmall" style={styles.emptyMembersText}>No members found.</Text>
          )}
        </View>

        {/* PROGRESSIVE DISCLOSURE INVITATION ADMIN (LAW 10: DISCLOSED ON DEMAND) */}
        {isOwner && (
          <View style={styles.inviteSection}>
            {!inviteAdminExpanded ? (
              <Button
                title="➕ Invite Someone to Circle"
                onPress={() => setInviteAdminExpanded(true)}
                variant="primary"
                size="md"
                style={styles.inviteBtn}
              />
            ) : (
              <View>
                <TouchableOpacity
                  style={styles.collapseRow}
                  onPress={() => setInviteAdminExpanded(false)}
                  activeOpacity={0.7}
                >
                  <Text variant="micro" style={styles.collapseText}>▲ Hide Invite Controls</Text>
                </TouchableOpacity>

                <InviteCodeCard
                  code={generatedCode}
                  expiresAt={inviteExpiresAt}
                  isLoading={isGeneratingCode}
                  error={inviteError}
                  onCopy={handleCopyCode}
                  onGenerateNew={handleGenerateInvite}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  padding: {
    padding: spacing.md,
  },
  header: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  headerTitleGroup: {
    flex: 1,
  },
  eyebrowTitle: {
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  groupTitle: {
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  onboardingCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  onboardingTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  onboardingSub: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  membersSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  loaderStyle: {
    marginVertical: spacing.md,
  },
  emptyMembersText: {
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
  inviteSection: {
    marginTop: spacing.sm,
  },
  inviteBtn: {
    width: '100%',
  },
  collapseRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  collapseText: {
    color: colors.textMuted,
  },
});

export default GroupScreen;
