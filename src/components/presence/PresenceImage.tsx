import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, useWindowDimensions, ViewStyle } from 'react-native';
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
          if (w > 0 && h > 0) setAspectRatio(w / h);
        },
        () => {}
      );
    }
  }, [uri]);

  return (
    <View style={[styles.imageContainer, style]}>
      <Image
        source={{ uri }}
        style={[styles.image, { aspectRatio: aspectRatio || 1.777 }]}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: 360,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    maxHeight: 360,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
  },
});

export default PresenceImage;
