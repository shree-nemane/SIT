/**
 * ============================================================================
 * ARCHITECTURAL & PHILOSOPHY GUARDRAIL (LAW 28 / LAW 40)
 * ============================================================================
 * THIS SCREEN IS STRICTLY ON THE "INFORMATION NOT PERFORMANCE" SIDE OF LAW 28.
 *
 * DO NOT ADD:
 * - Streaks (e.g. "5 day check-in streak!")
 * - Check-in counts or frequency metrics (e.g. "Checked in 12 times this month")
 * - Response times or activity feeds
 * - Engagement rankings or badges
 *
 * The sole purpose of Member Detail is to view a close person's current status
 * and last check-in timestamp quietly, without gamification or performance pressure.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { PresenceImage } from '../../components/presence/PresenceImage';
import Text from '../../components/ui/Text';
import { colors, spacing } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/time';
import MemberRepository from '../../data/repositories/MemberRepository';
import PresenceRepository from '../../data/repositories/PresenceRepository';

export const MemberDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { memberId } = route.params || {};
  const [memberInfo, setMemberInfo] = useState<any | null>(null);
  const [presenceInfo, setPresenceInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!memberId) {
        setIsLoading(false);
        return;
      }

      try {
        const mem = await MemberRepository.getMember(memberId);
        const pres = await PresenceRepository.getActivePresenceForMember(memberId);
        setMemberInfo(mem);
        setPresenceInfo(pres);
      } catch (err) {
        if (__DEV__) {
          // console.log('[MemberDetailScreen] Error loading member details:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [memberId]);

  const displayName = memberInfo?.displayName || presenceInfo?.displayName || 'Circle Member';
  const avatarUri = memberInfo?.profileImageLocalPath || presenceInfo?.profileImageLocalPath;

  if (isLoading) {
    return (
      <ScreenContainer edges={['top']} style={styles.container}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text variant="bodySmall" style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top']} scrollable contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        {/* NAV BACK BAR */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text variant="bodySmall" style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* HERO MEMBER HEADER */}
        <View style={styles.header}>
          <Avatar uri={avatarUri} name={displayName} size="xl" style={styles.avatar} />
          <Text variant="h2" style={styles.displayName}>{displayName}</Text>
          {presenceInfo?.updatedAt ? (
            <Text variant="micro" style={styles.lastActiveText}>
              Last checked in {formatRelativeTime(presenceInfo.updatedAt)}
            </Text>
          ) : (
            <Text variant="micro" style={styles.lastActiveText}>No recent status update</Text>
          )}
        </View>

        {/* CURRENT STATUS CARD */}
        {presenceInfo ? (
          <Card variant="default" style={styles.statusCard}>
            <Text variant="micro" style={styles.statusHeaderTitle}>CURRENT STATUS</Text>

            {presenceInfo.presenceImageLocalPath ? (
              <PresenceImage uri={presenceInfo.presenceImageLocalPath} />
            ) : null}

            {presenceInfo.description ? (
              <Text variant="note" style={styles.noteText}>
                {presenceInfo.description}
              </Text>
            ) : (
              <Text variant="bodySmall" style={styles.emptyNoteText}>
                Quiet status update
              </Text>
            )}
          </Card>
        ) : (
          <Card variant="default" style={styles.statusCard}>
            <Text variant="bodySmall" style={styles.emptyMemberText}>
              {displayName} has not posted a status update yet today.
            </Text>
          </Card>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    padding: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  backBtnText: {
    color: colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  avatar: {
    marginBottom: spacing.sm,
  },
  displayName: {
    color: colors.textPrimary,
  },
  lastActiveText: {
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  statusCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  statusHeaderTitle: {
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  noteText: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  emptyNoteText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  emptyMemberText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});

export default MemberDetailScreen;
