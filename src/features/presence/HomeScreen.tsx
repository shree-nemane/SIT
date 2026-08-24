import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { PresenceCard } from '../../components/presence/PresenceCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Button } from '../../components/ui/Button';
import Text from '../../components/ui/Text';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import PresenceRepository from '../../data/repositories/PresenceRepository';
import syncEngine from '../sync/syncEngine';
import widgetSnapshotService from '../widget/widgetSnapshot';
import { formatRelativeTime } from '../../utils/time';

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

export const HomeScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { member, groupName } = useAuthStore();
  const [presences, setPresences] = useState<GroupPresenceItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(new Date().toISOString());
  const [isOffline, setIsOffline] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Reversible Exploration Undo Toast State (Law 25)
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [undoMemberId, setUndoMemberId] = useState<string | null>(null);
  const [undoPresenceId, setUndoPresenceId] = useState<string | null>(null);
  const [undoText, setUndoText] = useState<string>('');

  // Clear Status confirmation modal state
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [isDeletingStatus, setIsDeletingStatus] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  const loadPresencesFromLocal = useCallback(async () => {
    const data = await PresenceRepository.getAllGroupPresences();
    setPresences(data);
  }, []);

  // Handle route params for 1-tap Undo Toast (Law 25)
  useEffect(() => {
    if (route.params?.showUndoToast && route.params?.undoMemberId) {
      setUndoToastVisible(true);
      setUndoMemberId(route.params.undoMemberId);
      setUndoPresenceId(route.params.undoPresenceId || null);
      setUndoText(route.params.undoStatusText || 'Checked in');

      // Clear navigation params after reading
      navigation.setParams({ showUndoToast: undefined, undoMemberId: undefined, undoPresenceId: undefined, undoStatusText: undefined });

      // Auto-hide toast after 5 seconds
      const timer = setTimeout(() => {
        setUndoToastVisible(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [route.params, navigation]);

  const handleUndoCheckIn = async () => {
    if (!undoMemberId) return;
    setUndoToastVisible(false);
    await PresenceRepository.deletePresenceTransaction({
      memberId: undoMemberId,
      presenceId: undoPresenceId || undefined,
    });
    await loadPresencesFromLocal();
    await widgetSnapshotService.updateAndNotifyWidget();
    syncEngine.syncAll();
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSyncError(null);
    try {
      const result = await syncEngine.syncAll();
      setLastSyncTime(new Date().toISOString());
      setIsOffline(false);
    } catch (e: any) {
      setIsOffline(true);
      setSyncError('Could not sync latest updates from circle.');
    }
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
      setLastSyncTime(new Date().toISOString());
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

  const myPresenceItem = presences.find((p) => p.memberId === member?.id);
  const friendsPresences = presences.filter((p) => p.memberId !== member?.id);

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.contentPadding}>
          {/* EYEBROW QUIET PAGE TITLE (LAW 4 & LAW 5) */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text variant="micro" style={styles.eyebrowTitle}>TODAY</Text>
              <Text variant="h2" style={styles.circleHeading}>{groupName || 'Private Circle'}</Text>
            </View>
          </View>

          {/* REVERSIBLE EXPLORATION UNDO TOAST (LAW 25) */}
          {undoToastVisible && (
            <View style={styles.undoToastBanner}>
              <Text variant="bodySmall" style={styles.undoToastText} numberOfLines={1}>
                Status updated: "{undoText}"
              </Text>
              <TouchableOpacity style={styles.undoToastBtn} onPress={handleUndoCheckIn} activeOpacity={0.8}>
                <Text variant="label" style={styles.undoToastBtnText}>Undo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TRUTHFUL OFFLINE STATE BANNER (LAW 35: NEVER FAKE CERTAINTY) */}
          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text variant="micro" style={styles.offlineText}>
                ⚡ Offline mode — Last updated {lastSyncTime ? formatRelativeTime(lastSyncTime) : 'recently'}
              </Text>
            </View>
          )}

          {/* DIGNIFIED ERROR STATE (LAW 19) */}
          {syncError && (
            <ErrorState
              title="Sync paused"
              message={syncError}
              safeMessage="Your local presence updates remain safely stored."
              onRetry={handleRefresh}
            />
          )}

          {/* YOUR STATUS ROW (QUIET INLINE CONTAINER - NO GLOW, INLINE CHECK IN CTA) */}
          <View style={styles.selfSectionCard}>
            <View style={styles.selfHeaderRow}>
              <Text variant="micro" style={styles.sectionHeaderText}>YOUR STATUS</Text>
              <Button
                title="+ Check In"
                onPress={() => navigation.navigate('CheckIn')}
                variant="primary"
                size="sm"
              />
            </View>

            {myPresenceItem ? (
              <PresenceCard
                item={myPresenceItem}
                isOwn
                onClearStatus={() => handleRequestClearPresence(myPresenceItem.memberId)}
              />
            ) : (
              <Text variant="bodySmall" style={styles.noStatusText}>
                You haven't posted a status today. Tap + Check In to update your circle.
              </Text>
            )}
          </View>

          {/* CIRCLE PRESENCES (PRIMARY VISUAL ELEMENT) */}
          <View style={styles.friendsSectionHeader}>
            <Text variant="micro" style={styles.sectionHeaderText}>CIRCLE UPDATES ({friendsPresences.length})</Text>
          </View>

          {friendsPresences.length > 0 ? (
            friendsPresences.map((item) => (
              <PresenceCard
                key={item.presenceId}
                item={item}
              />
            ))
          ) : (
            <EmptyState
              title="Your circle is quiet today"
              message="When people in your circle share a status, it will quietly appear here."
            />
          )}
        </View>
      </ScrollView>

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
    paddingBottom: 90,
  },
  contentPadding: {
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
  circleHeading: {
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  undoToastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.surfaceBorderLight,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  undoToastText: {
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  undoToastBtn: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: borderRadius.sm,
  },
  undoToastBtnText: {
    color: colors.primary,
  },
  offlineBanner: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineText: {
    color: colors.textMuted,
  },
  selfSectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  selfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeaderText: {
    color: colors.textMuted,
    letterSpacing: 1,
  },
  noStatusText: {
    color: colors.textMuted,
    marginVertical: spacing.xs,
  },
  friendsSectionHeader: {
    marginBottom: spacing.xs,
  },
});

export default HomeScreen;
