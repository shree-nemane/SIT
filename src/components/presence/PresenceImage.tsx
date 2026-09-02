import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, ViewStyle } from 'react-native';
import { borderRadius, spacing } from '../../theme/theme';

export interface PresenceImageProps {
  uri: string;
  style?: ViewStyle;
}

export const PresenceImage: React.FC<PresenceImageProps> = ({ uri, style }) => {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  useEffect(() => {
    if (uri) {
      Image.getSize(
        uri,
        (w, h) => {
          if (w > 0 && h > 0) {
            setAspectRatio(w / h);
          }
        },
        () => {}
      );
    }
  }, [uri]);

  return (
    <View style={[styles.imageContainer, style]}>
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { aspectRatio: aspectRatio > 0 ? aspectRatio : 16 / 9 },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  image: {
    width: '100%',
    maxHeight: 420,
    borderRadius: borderRadius.md,
  },
});

export default PresenceImage;
