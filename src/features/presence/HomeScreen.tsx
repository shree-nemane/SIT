import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { PresenceCard } from '../../components/presence/PresenceCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { colors, spacing, typography, shadows } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import PresenceRepository from '../../data/repositories/PresenceRepository';
import syncEngine from '../sync/syncEngine';
import widgetSnapshotService from '../widget/widgetSnapshot';

interface GroupPresenceItem {
  presenceId: string;
  memberId: string;
  displayName: string;
  profileImageId: string | null;
  profileImageLocalPath: string | null;
  description: string;
  imageId: string | null;
  presenceImageLocalPath: string | null;
  updatedAt: string;
  syncStatus: string;
}

const getDynamicGreeting = (name: string): string => {
  const hour = new Date().getHours();
  let timeOfDay = 'day';
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return `Good ${timeOfDay}, ${name} 👋`;
};

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { member, groupName, userId } = useAuthStore();
  const [presences, setPresences] = useState<GroupPresenceItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Clear Status confirmation modal state
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [isDeletingStatus, setIsDeletingStatus] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  const loadPresencesFromLocal = useCallback(async () => {
    const data = await PresenceRepository.getAllGroupPresences();
    setPresences(data);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await syncEngine.syncAll();
    await loadPresencesFromLocal();
    setIsRefreshing(false);
  }, [loadPresencesFromLocal]);

  useEffect(() => {
    loadPresencesFromLocal();

    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadPresencesFromLocal();
    });

    const unsubscribeSync = syncEngine.subscribe(() => {
      loadPresencesFromLocal();
    });

    return () => {
      unsubscribeFocus();
      unsubscribeSync();
    };
  }, [navigation, loadPresencesFromLocal]);

  const handleRequestClearPresence = (memberId: string) => {
    setTargetMemberId(memberId);
    setClearConfirmVisible(true);
  };

  const handleConfirmClearPresence = async () => {
    if (!targetMemberId || isDeletingStatus) return;

    setIsDeletingStatus(true);
    await PresenceRepository.deletePresenceTransaction(targetMemberId);
    await loadPresencesFromLocal();
    await widgetSnapshotService.updateAndNotifyWidget();
    syncEngine.syncAll();
    setIsDeletingStatus(false);
    setClearConfirmVisible(false);
    setTargetMemberId(null);
  };

  const activeUserId = member?.id || userId;
  const myPresenceItem = presences.find((p) => p.memberId === activeUserId);
  const friendsPresences = presences.filter((p) => p.memberId !== activeUserId);
  const userName = member?.displayName || 'Friend';

  // Dynamic viewport edge positioning calculations
  const bottomMargin = Math.max(insets.bottom, spacing.xs);
  const fabBottomPosition = 60 + bottomMargin + spacing.md; // 60px tab height + tab bottom margin + 16px gap
  const scrollBottomPadding = 60 + bottomMargin + 60 + spacing.lg; // Clears both tab bar & FAB completely

  return (
    <ScreenContainer edges={['top']} scrollable={false} style={styles.flexOne}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.contentPadding}>
          {/* COMPACT APP / GROUP IDENTITY HEADER */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.appTitle}>Stay in Touch</Text>
              <Text style={styles.greetingText}>{getDynamicGreeting(userName)}</Text>
            </View>
            <Badge label={`🔒 ${groupName || 'Private Circle'}`} variant="group" />
          </View>

          {/* YOUR STATUS SECTION */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>YOUR STATUS</Text>
          </View>

          {myPresenceItem ? (
            <PresenceCard
              item={myPresenceItem}
              isOwn
              onClearStatus={() => handleRequestClearPresence(myPresenceItem.memberId)}
            />
          ) : (
            <EmptyState
              title="You haven't checked in yet"
              message="Share what you're up to right now with your circle."
              actionTitle="+ Check In Now"
              onAction={() => navigation.navigate('CheckIn')}
            />
          )}

          {/* FRIENDS SECTION */}
          <View style={styles.friendsSectionHeader}>
            <Text style={styles.sectionHeaderText}>YOUR CIRCLE ({friendsPresences.length})</Text>
          </View>

          {friendsPresences.length > 0 ? (
            friendsPresences.map((item) => (
              <PresenceCard key={item.presenceId} item={item} />
            ))
          ) : (
            <EmptyState
              title="Your circle is quiet"
              message="When friends in your circle check in, their updates will appear here."
            />
          )}
        </View>
      </ScrollView>

      {/* PROMINENT TRULY FLOATING ACTION BUTTON (PINNED TO VIEWPORT) */}
      <TouchableOpacity
        style={[styles.fabButton, { bottom: fabBottomPosition }]}
        onPress={() => navigation.navigate('CheckIn')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabButtonText}>+ Check In</Text>
      </TouchableOpacity>

      {/* THEMED CLEAR STATUS CONFIRMATION MODAL */}
      <ConfirmModal
        visible={clearConfirmVisible}
        title="Clear Presence Status"
        message="Are you sure you want to clear your current presence status?"
        confirmTitle="Clear Status"
        cancelTitle="Cancel"
        isDestructive
        isLoading={isDeletingStatus}
        onConfirm={handleConfirmClearPresence}
        onCancel={() => {
          if (!isDeletingStatus) {
            setClearConfirmVisible(false);
            setTargetMemberId(null);
          }
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentPadding: {
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
  sectionHeaderContainer: {
    marginVertical: spacing.xs,
  },
  sectionHeaderText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
  },
  friendsSectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    ...shadows.fab,
  },
  fabButtonText: {
    color: colors.textInverse,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.weights.heavy,
  },
});

export default HomeScreen;
