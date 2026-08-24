import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { colors, spacing, typography } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/time';

export interface MemberItemProps {
  id: string;
  displayName: string;
  profileImageLocalPath?: string | null;
  isOwner?: boolean;
  joinedAt?: string;
  isMe?: boolean;
  onPress?: () => void;
}

export const MemberRow: React.FC<MemberItemProps> = ({
  displayName,
  profileImageLocalPath,
  isOwner = false,
  joinedAt,
  isMe = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Avatar uri={profileImageLocalPath} name={displayName} size="md" />

      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText}>{displayName}</Text>
          {isMe && <Badge label="YOU" variant="you" style={styles.badgeMargin} />}
          {isOwner && <Badge label="Owner" variant="owner" style={styles.badgeMargin} />}
        </View>
        {joinedAt && (
          <Text style={styles.joinedText}>Joined {formatRelativeTime(joinedAt)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
  },
  infoCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.weights.semibold,
  },
  badgeMargin: {
    marginLeft: spacing.xs,
  },
  joinedText: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
  },
});

export default MemberRow;
