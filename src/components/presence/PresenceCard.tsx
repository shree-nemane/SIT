import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { PresenceImage } from './PresenceImage';
import { HumanSyncBar } from './HumanSyncBar';
import { colors, spacing } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/time';
import Text from '../ui/Text';

export interface PresenceCardItem {
  presenceId: string;
  memberId: string;
  displayName: string;
  profileImageLocalPath: string | null;
  description: string;
  presenceImageLocalPath: string | null;
  updatedAt: string;
  syncStatus: string;
}

export interface PresenceCardProps {
  item: PresenceCardItem;
  isOwn?: boolean;
  onClearStatus?: () => void;
  onPressCard?: () => void;
}

const isValidImageUri = (uri: string | null): boolean => {
  if (!uri) return false;
  const clean = uri.trim();
  return (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('file://') ||
    clean.startsWith('content://')
  );
};

export const PresenceCard: React.FC<PresenceCardProps> = ({
  item,
  isOwn = false,
  onClearStatus,
  onPressCard,
}) => {
  const hasImage = isValidImageUri(item.presenceImageLocalPath);

  return (
    <Card
      variant="default"
      style={styles.cardContainer}
      onPress={onPressCard}
    >
      {/* HEADER: Avatar, Name, Badge, Time */}
      <View style={styles.headerRow}>
        <View style={styles.authorGroup}>
          <Avatar uri={item.profileImageLocalPath} name={item.displayName} size="md" />
          <View style={styles.nameRow}>
            <Text variant="subtitle" style={styles.displayName}>{item.displayName}</Text>
            {isOwn && <Badge label="YOU" variant="you" style={styles.youBadge} />}
          </View>
        </View>

        <Text variant="micro" style={styles.timeText}>{formatRelativeTime(item.updatedAt)}</Text>
      </View>

      {/* PHOTO-FIRST LAYOUT: Image is primary visual anchor when present */}
      {hasImage && <PresenceImage uri={item.presenceImageLocalPath!} />}

      {/* DESCRIPTION TEXT: Handwritten note style (Caveat) */}
      {item.description ? (
        <Text variant="note" style={[styles.descriptionText, hasImage && styles.descriptionUnderImage]}>
          {item.description}
        </Text>
      ) : null}

      {/* FOOTER: Sync indicator & Actions */}
      <View style={styles.footerRow}>
        <HumanSyncBar status={item.syncStatus as any} />

        {isOwn && onClearStatus && (
          <TouchableOpacity onPress={onClearStatus} style={styles.clearBtn} activeOpacity={0.7}>
            <Text variant="micro" style={styles.clearBtnText}>Clear Status</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  displayName: {
    color: colors.textPrimary,
  },
  youBadge: {
    marginLeft: spacing.xs,
  },
  timeText: {
    color: colors.textMuted,
  },
  descriptionText: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  descriptionUnderImage: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  clearBtn: {
    marginLeft: 'auto',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  clearBtnText: {
    color: colors.syncError,
  },
});

export default PresenceCard;
