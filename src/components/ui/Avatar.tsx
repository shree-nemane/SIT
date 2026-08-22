import React from 'react';
import { StyleSheet, Text, View, Image, ViewStyle, ImageStyle } from 'react-native';
import { colors, typography } from '../../theme/theme';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: AvatarSize;
  showOwnerBadge?: boolean;
  style?: ViewStyle;
}

const isValidImageUri = (uri: string | null | undefined): boolean => {
  if (!uri) return false;
  const clean = uri.trim();
  return (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('file://') ||
    clean.startsWith('content://')
  );
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = 'User',
  size = 'md',
  showOwnerBadge = false,
  style,
}) => {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { dimension: 28, fontSize: 12, borderRadius: 14 };
      case 'lg':
        return { dimension: 48, fontSize: 20, borderRadius: 24 };
      case 'xl':
        return { dimension: 90, fontSize: 36, borderRadius: 45 };
      case 'md':
      default:
        return { dimension: 36, fontSize: 16, borderRadius: 18 };
    }
  };

  const { dimension, fontSize, borderRadius: radius } = getDimensions();

  const containerStyle: ImageStyle = {
    width: dimension,
    height: dimension,
    borderRadius: radius,
  };

  const initialLetter = (name || 'U').charAt(0).toUpperCase();

  return (
    <View style={[styles.avatarWrapper, style]}>
      {isValidImageUri(uri) ? (
        <Image
          source={{ uri: uri! }}
          style={[styles.avatarImage, containerStyle]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.avatarFallback, containerStyle]}>
          <Text style={[styles.avatarText, { fontSize }]}>{initialLetter}</Text>
        </View>
      )}

      {showOwnerBadge && (
        <View style={styles.ownerBadgeDot}>
          <Text style={styles.crownText}>👑</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    backgroundColor: colors.surfaceElevated,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  avatarFallback: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  ownerBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  crownText: {
    fontSize: 10,
  },
});

export default Avatar;
