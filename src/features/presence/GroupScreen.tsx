import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  NativeModules,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { MemberRow } from '../../components/group/MemberRow';
import { InviteCodeCard } from '../../components/group/InviteCodeCard';
import { colors, spacing, typography } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import MemberRepository, { GroupDetailInfo } from '../../data/repositories/MemberRepository';
import { api } from '../../data/api';
import syncEngine from '../sync/syncEngine';

const generateRandom6Char = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const GroupScreen: React.FC = () => {
  const { member, groupName, userId } = useAuthStore();
  const [groupDetails, setGroupDetails] = useState<GroupDetailInfo | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const fetchActiveOrGenerateInvite = useCallback(async (forceNew = false) => {
    setIsGeneratingCode(true);
    setInviteError(null);

    if (!forceNew) {
      const activeRes = await api.getActiveInvitation();
      if (activeRes.success && activeRes.code) {
        setGeneratedCode(activeRes.code);
        setInviteExpiresAt(activeRes.expiresAt || null);
        setIsGeneratingCode(false);
        return;
      }
    }

    const newCode = generateRandom6Char();
    const res = await api.generateInvitation(newCode);
    setIsGeneratingCode(false);

    if (res.success && res.code) {
      setGeneratedCode(res.code);
      setInviteExpiresAt(res.expiresAt || null);
    } else {
      setInviteError(res.error || 'Only the group owner can generate invitation codes.');
    }
  }, []);

  useEffect(() => {
    loadGroupDetails();
    fetchActiveOrGenerateInvite(false);

    const unsubscribeSync = syncEngine.subscribe(() => {
      loadGroupDetails();
    });

    return () => {
      unsubscribeSync();
    };
  }, [loadGroupDetails, fetchActiveOrGenerateInvite]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncEngine.syncAll();
    await loadGroupDetails();
    await fetchActiveOrGenerateInvite(false);
    setIsRefreshing(false);
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;

    try {
      const ClipboardModule = NativeModules.Clipboard;
      if (ClipboardModule && typeof ClipboardModule.setString === 'function') {
        ClipboardModule.setString(generatedCode);
        Alert.alert('Code Copied!', `Invitation code "${generatedCode}" copied to clipboard.`);
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
        {/* CUSTOM RESPONSIVE PAGE DISPLAY HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.appTitle}>Your Circle</Text>
            <Text style={styles.greetingText}>
              {groupDetails?.members.length || 1}{' '}
              {groupDetails?.members.length === 1 ? 'member' : 'members'} in your private circle
            </Text>
          </View>
          {/* <Badge label={` ${groupName || 'Private Circle'}`} variant="group" /> */}
        </View>

        {/* GROUP SUMMARY CARD */}
        <Card variant="elevated" style={styles.bannerCard}>
          <Text style={styles.groupTitle}>{groupDetails?.name || groupName || 'Private Circle'}</Text>
          <Text style={styles.memberCountSub}>
            Private & encrypted space shared only with members of this circle.
          </Text>
        </Card>

        {/* 24-HOUR INVITATION CODE SECTION (Strictly for Owner) */}
        {isOwner && (
          <InviteCodeCard
            code={generatedCode}
            expiresAt={inviteExpiresAt}
            isLoading={isGeneratingCode}
            error={inviteError}
            onCopy={handleCopyCode}
            onGenerateNew={() => fetchActiveOrGenerateInvite(true)}
          />
        )}

        {/* MEMBER LIST SECTION - CARD REDUCED (DIRECT LIST VIEW) */}
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>YOUR CIRCLE MEMBERS</Text>

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
              />
            ))
          ) : (
            <Text style={styles.emptyMembersText}>No members found.</Text>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  padding: {
    // Rely on ScreenContainer default 16px side padding
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  appTitle: {
    color: colors.primary,
    fontSize: typography.fontSizes.display,
    fontWeight: typography.weights.heavy,
    letterSpacing: -0.5,
  },
  greetingText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.md,
    marginTop: spacing.xxs,
  },
  bannerCard: {
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  groupTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.weights.heavy,
  },
  memberCountSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    marginTop: spacing.xs,
  },
  membersSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  loaderStyle: {
    marginVertical: spacing.md,
  },
  emptyMembersText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    marginVertical: spacing.sm,
  },
});

export default GroupScreen;
