import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, useWindowDimensions, ViewStyle } from 'react-native';
import { borderRadius, spacing } from '../../theme/theme';

export interface PresenceImageProps {
  uri: string;
  style?: ViewStyle;
}

export const PresenceImage: React.FC<PresenceImageProps> = ({ uri, style }) => {
  const { width: windowWidth } = useWindowDimensions();
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

  // Account for horizontal screen margins
  const availableWidth = Math.max(260, windowWidth - spacing.md * 4);
  const MAX_HEIGHT = 360;

  const naturalHeight = availableWidth / (aspectRatio || 1.777);

  let displayWidth = availableWidth;
  let displayHeight = naturalHeight;

  if (naturalHeight > MAX_HEIGHT) {
    displayHeight = MAX_HEIGHT;
    displayWidth = displayHeight * (aspectRatio || 1.777);
  }

  return (
    <View
      style={[
        styles.imageContainer,
        { width: displayWidth, height: displayHeight },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    alignSelf: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
  },
});

export default PresenceImage;
