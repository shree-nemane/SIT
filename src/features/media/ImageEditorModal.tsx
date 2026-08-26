import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Image,
  PanResponder,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing, typography, borderRadius, fonts } from '../../theme/theme';
import { Button } from '../../components/ui/Button';
import imagePipeline, { ProcessedImageResult } from './imagePipeline';

export interface ImageEditorModalProps {
  visible: boolean;
  mode: 'PROFILE' | 'PRESENCE';
  sourceUri: string | null;
  onClose: () => void;
  onApply: (result: ProcessedImageResult) => void;
}



export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  visible,
  mode,
  sourceUri,
  onClose,
  onApply,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  const [scale, setScale] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({
    width: 1080,
    height: 1080,
  });

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  useEffect(() => {
    if (visible && sourceUri) {
      pan.setValue({ x: 0, y: 0 });
      pan.setOffset({ x: 0, y: 0 });
      setScale(1.0);
      setIsProcessing(false);

      Image.getSize(
        sourceUri,
        (w, h) => {
          if (w > 0 && h > 0) {
            setImgDimensions({ width: w, height: h });
          }
        },
        (err) => {
          console.warn('[ImageEditorModal] Failed to get image size:', err);
        }
      );
    }
  }, [visible, sourceUri, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const handleReset = () => {
    pan.setValue({ x: 0, y: 0 });
    pan.setOffset({ x: 0, y: 0 });
    setScale(1.0);
  };

  const handleApply = async () => {
    if (!sourceUri) return;
    setIsProcessing(true);

    try {
      const sourceWidth = imgDimensions.width || 1080;
      const sourceHeight = imgDimensions.height || 1080;

      // Extract exact accumulated drag offset in pixels
      const totalX = ((pan.x as any)._value || 0) + ((pan.x as any)._offset || 0);
      const totalY = ((pan.y as any)._value || 0) + ((pan.y as any)._offset || 0);

      let cropX = 0;
      let cropY = 0;
      let cropWidth = 1.0;
      let cropHeight = 1.0;

      if (scale > 1.01 || Math.abs(totalX) > 1 || Math.abs(totalY) > 1) {
        cropWidth = Math.max(0.05, Math.min(1.0, 1.0 / scale));
        cropHeight = Math.max(0.05, Math.min(1.0, 1.0 / scale));

        const normOffsetX = totalX / (cropBoxWidth * scale);
        const normOffsetY = totalY / (cropBoxHeight * scale);

        cropX = Math.max(0, Math.min(1.0 - cropWidth, (1.0 - cropWidth) / 2.0 - normOffsetX));
        cropY = Math.max(0, Math.min(1.0 - cropHeight, (1.0 - cropHeight) / 2.0 - normOffsetY));
      }

      // Preserve full original aspect ratio without square pre-cropping
      const result = await imagePipeline.cropAndScaleImage(
        sourceUri,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        undefined,
        undefined,
        sourceWidth,
        sourceHeight
      );

      setIsProcessing(false);
      if (result) {
        onApply(result);
      } else {
        onApply({
          imageId: `img_${Date.now()}`,
          localPath: sourceUri,
          width: sourceWidth,
          height: sourceHeight,
          fileSize: 200000,
        });
      }
    } catch (err) {
      console.error('[ImageEditorModal] Apply crop error:', err);
      setIsProcessing(false);
      onClose();
    }
  };

  if (!visible || !sourceUri) return null;

  const isProfile = mode === 'PROFILE';
  const imageAspectRatio = (imgDimensions.width && imgDimensions.height)
    ? imgDimensions.width / imgDimensions.height
    : 1.0;

  const CROP_CANVAS_WIDTH = Math.min(340, windowWidth - spacing.xs * 2);
  const MAX_CROP_CANVAS_HEIGHT = 440;

  let cropBoxWidth = CROP_CANVAS_WIDTH;
  let cropBoxHeight = CROP_CANVAS_WIDTH;

  const calcH = CROP_CANVAS_WIDTH / (imageAspectRatio || 1.0);
  if (calcH <= MAX_CROP_CANVAS_HEIGHT) {
    cropBoxWidth = CROP_CANVAS_WIDTH;
    cropBoxHeight = calcH;
  } else {
    cropBoxHeight = MAX_CROP_CANVAS_HEIGHT;
    cropBoxWidth = cropBoxHeight * (imageAspectRatio || 1.0);
    if (cropBoxWidth > CROP_CANVAS_WIDTH) {
      cropBoxWidth = CROP_CANVAS_WIDTH;
      cropBoxHeight = cropBoxWidth / (imageAspectRatio || 1.0);
    }
  }

  const cutoutCircleDiameter = Math.min(cropBoxWidth, cropBoxHeight);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isProcessing} activeOpacity={0.7} style={styles.cancelTouch}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {isProfile ? 'Profile Picture' : 'Presence Photo'}
          </Text>

          <Button
            title="Use Photo"
            onPress={handleApply}
            variant="primary"
            size="sm"
            isLoading={isProcessing}
            disabled={isProcessing}
          />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* FRAMING WORKSPACE */}
          <View style={styles.workspace}>
            <Text style={styles.instructionText}>
              {isProfile
                ? 'Drag & pinch inside circle to frame profile avatar'
                : 'Pinch & drag to adjust status photo framing'}
            </Text>

            <View
              style={[
                styles.cropContainer,
                styles.cropBoxSelfCenter,
                { width: cropBoxWidth, height: cropBoxHeight },
              ]}
            >
              <View style={styles.cropTouchArea} {...panResponder.panHandlers}>
                <Animated.View
                  style={[
                    styles.imageWrapper,
                    {
                      transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { scale: scale },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: sourceUri }}
                    style={styles.sourceImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>

              {/* OVERLAY GUIDE GRID (PRESENCE MODE) */}
              {!isProfile && <View style={styles.overlayFrame} pointerEvents="none" />}

              {/* WHATSAPP-STYLE LOW OPACITY CIRCLE CUTOUT OVERLAY (PROFILE MODE ONLY) */}
              {isProfile && (() => {
                const maskMargin = 400;
                const outerSize = cutoutCircleDiameter + maskMargin * 2;
                const outerRadius = outerSize / 2;

                return (
                  <View style={styles.whatsappMaskContainer} pointerEvents="none">
                    <View
                      style={[
                        styles.whatsappMaskCircle,
                        {
                          width: outerSize,
                          height: outerSize,
                          borderRadius: outerRadius,
                          borderWidth: maskMargin,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.whatsappMaskRing,
                        {
                          width: cutoutCircleDiameter,
                          height: cutoutCircleDiameter,
                          borderRadius: cutoutCircleDiameter / 2,
                        },
                      ]}
                    />
                  </View>
                );
              })()}
            </View>

            {/* ZOOM & RESET CONTROL BAR */}
            <View style={styles.controlsRow}>
              <Button
                title="−"
                onPress={() => setScale((s) => Math.max(1.0, s - 0.2))}
                variant="secondary"
                size="sm"
                style={styles.zoomControlBtn}
              />
              <View style={styles.scaleBadge}>
                <Text style={styles.scaleText}>{scale.toFixed(1)}x</Text>
              </View>
              <Button
                title="+"
                onPress={() => setScale((s) => Math.min(3.0, s + 0.2))}
                variant="secondary"
                size="sm"
                style={styles.zoomControlBtn}
              />
              <Button
                title="Reset"
                onPress={handleReset}
                variant="ghost"
                size="sm"
                style={styles.resetControlBtn}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  cancelTouch: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.manrope.medium,
  },
  headerTitle: {
    fontSize: typography.fontSizes.md,
    fontFamily: fonts.manrope.bold,
    color: colors.textPrimary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  workspace: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  instructionText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.manrope.medium,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  cropContainer: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorderLight,
    borderRadius: borderRadius.md,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropBoxSelfCenter: {
    alignSelf: 'center',
  },
  cropTouchArea: {
    width: '100%',
    height: '100%',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceImage: {
    width: '100%',
    height: '100%',
  },
  overlayFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  whatsappMaskContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  whatsappMaskCircle: {
    borderColor: 'rgba(245, 245, 247, 0.72)',
    backgroundColor: 'transparent',
  },
  whatsappMaskRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs + 4,
  },
  zoomControlBtn: {
    minWidth: 44,
  },
  scaleBadge: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 54,
    alignItems: 'center',
  },
  scaleText: {
    color: colors.textPrimary,
    fontFamily: fonts.manrope.bold,
    fontSize: typography.fontSizes.xs,
  },
  resetControlBtn: {
    marginLeft: spacing.xs,
  },
  previewSection: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  previewSectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  previewsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewBox: {
    flex: 1,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xxs,
    marginBottom: 4,
  },
  appFeedCardPreview: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.xs + 2,
    minHeight: 90,
  },
  previewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  previewAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  previewSmallAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  previewMemberName: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.bold,
  },
  previewPresenceImageContainer: {
    width: '100%',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  polaroidWidgetPreview: {
    backgroundColor: '#F7F5EE',
    borderRadius: 8,
    padding: 8,
    minHeight: 110,
  },
  polaroidImageContainer: {
    width: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#EFECE4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  polaroidAvatarContainer: {
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#EFECE4',
  },
  polaroidBottomChin: {
    paddingTop: 8,
    alignItems: 'center',
  },
  polaroidHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 2,
  },
  polaroidAvatarSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  polaroidDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    alignSelf: 'center',
  },
  polaroidTitleText: {
    color: '#1C1917',
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.bold,
  },
  polaroidCounterText: {
    color: '#8C857B',
    fontSize: 9,
  },
  polaroidCaptionText: {
    color: '#292524',
    fontSize: typography.fontSizes.xxs,
    textAlign: 'center',
  },
  polaroidTimestampText: {
    color: '#8C857B',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ImageEditorModal;
