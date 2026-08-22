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
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme/theme';
import imagePipeline, { ProcessedImageResult } from './imagePipeline';

export interface ImageEditorModalProps {
  visible: boolean;
  mode: 'PROFILE' | 'PRESENCE';
  sourceUri: string | null;
  onClose: () => void;
  onApply: (result: ProcessedImageResult) => void;
}

interface LivePreviewCardProps {
  label: string;
  isWidget?: boolean;
  isProfile: boolean;
  sourceUri: string;
  currentOffset: { x: number; y: number };
  scale: number;
  imageAspectRatio: number;
}

const LivePreviewCard: React.FC<LivePreviewCardProps> = ({
  label,
  isWidget,
  isProfile,
  sourceUri,
  currentOffset,
  scale,
  imageAspectRatio,
}) => {
  const WIDGET_PREVIEW_WIDTH = 130;
  const rawWidgetHeight = WIDGET_PREVIEW_WIDTH / (imageAspectRatio || 1.777);
  const widgetImageHeight = Math.min(90, rawWidgetHeight);

  const FEED_PREVIEW_WIDTH = 130;
  const feedImageHeight = Math.min(130, FEED_PREVIEW_WIDTH / (imageAspectRatio || 1.777));

  if (isWidget) {
    return (
      <View style={styles.previewBox}>
        <Text style={styles.previewLabel}>{label}</Text>
        <View style={styles.polaroidWidgetPreview}>
          {/* POLAROID PHOTO FRAME (DOMINANT VISUAL AREA AT TOP) */}
          {!isProfile ? (
            <View style={[styles.polaroidImageContainer, { height: widgetImageHeight }]}>
              <Image
                source={{ uri: sourceUri }}
                style={[
                  styles.previewImage,
                  scale > 1.05 || currentOffset.x !== 0 || currentOffset.y !== 0
                    ? {
                        transform: [
                          { translateX: currentOffset.x * 0.15 },
                          { translateY: currentOffset.y * 0.15 },
                          { scale },
                        ],
                      }
                    : null,
                ]}
                resizeMode={scale > 1.05 ? 'cover' : 'contain'}
              />
            </View>
          ) : (
            <View style={styles.polaroidAvatarContainer}>
              <View style={styles.polaroidAvatarCircle}>
                <Image
                  source={{ uri: sourceUri }}
                  style={[
                    styles.previewImage,
                    {
                      transform: [
                        { translateX: currentOffset.x * 0.1 },
                        { translateY: currentOffset.y * 0.1 },
                        { scale },
                      ],
                    },
                  ]}
                  resizeMode="cover"
                />
              </View>
            </View>
          )}

          {/* POLAROID BOTTOM CHIN (AVATAR + NAME, PRESENCE CAPTION, TIMESTAMP) */}
          <View style={styles.polaroidBottomChin}>
            <View style={styles.polaroidHeaderRow}>
              <View style={styles.polaroidAvatarSmall}>
                {isProfile ? (
                  <Image source={{ uri: sourceUri }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                  <View style={styles.polaroidDot} />
                )}
              </View>
              <Text style={styles.polaroidTitleText} numberOfLines={1}>Stay in Touch</Text>
              <Text style={styles.polaroidCounterText}>1/1</Text>
            </View>
            <Text style={styles.polaroidCaptionText} numberOfLines={1}>
              {isProfile ? 'Updated profile' : 'Status preview'}
            </Text>
            <Text style={styles.polaroidTimestampText}>Just now · Tap to cycle</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewBox}>
      <Text style={styles.previewLabel}>{label}</Text>
      <View style={styles.appFeedCardPreview}>
        <View style={styles.previewCardHeader}>
          {isProfile ? (
            <View style={styles.previewAvatarCircle}>
              <Image
                source={{ uri: sourceUri }}
                style={[
                  styles.previewImage,
                  {
                    transform: [
                      { translateX: currentOffset.x * 0.1 },
                      { translateY: currentOffset.y * 0.1 },
                      { scale },
                    ],
                  },
                ]}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.previewSmallAvatar} />
          )}
          <Text style={styles.previewMemberName}>You</Text>
        </View>

        {!isProfile && (
          <View
            style={[
              styles.previewPresenceImageContainer,
              { height: feedImageHeight },
            ]}
          >
            <Image
              source={{ uri: sourceUri }}
              style={[
                styles.previewImage,
                scale > 1.05 || currentOffset.x !== 0 || currentOffset.y !== 0
                  ? {
                      transform: [
                        { translateX: currentOffset.x * 0.15 },
                        { translateY: currentOffset.y * 0.15 },
                        { scale },
                      ],
                    }
                  : null,
              ]}
              resizeMode={scale > 1.05 ? 'cover' : 'contain'}
            />
          </View>
        )}
      </View>
    </View>
  );
};

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  visible,
  mode,
  sourceUri,
  onClose,
  onApply,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const canvasSize = Math.min(240, windowWidth - spacing.xl * 2);

  const [scale, setScale] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({
    width: 1080,
    height: 1080,
  });

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const listener = pan.addListener((value) => {
      currentOffset.current = value;
    });
    return () => pan.removeListener(listener);
  }, [pan]);

  useEffect(() => {
    if (visible && sourceUri) {
      pan.setValue({ x: 0, y: 0 });
      currentOffset.current = { x: 0, y: 0 };
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
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: currentOffset.current.x,
          y: currentOffset.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const handleReset = () => {
    pan.setValue({ x: 0, y: 0 });
    currentOffset.current = { x: 0, y: 0 };
    setScale(1.0);
  };

  const handleApply = async () => {
    if (!sourceUri) return;
    setIsProcessing(true);

    try {
      const isProfile = mode === 'PROFILE';
      const sourceWidth = imgDimensions.width || 1080;
      const sourceHeight = imgDimensions.height || 1080;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = 1.0;
      let cropHeight = 1.0;

      if (isProfile) {
        let baseNormW = 1.0;
        let baseNormH = 1.0;
        let baseNormX = 0.0;
        let baseNormY = 0.0;

        const sourceAspect = sourceWidth / sourceHeight;
        if (sourceAspect >= 1.0) {
          baseNormW = 1.0 / sourceAspect;
          baseNormH = 1.0;
          baseNormX = (1.0 - baseNormW) / 2.0;
          baseNormY = 0.0;
        } else {
          baseNormW = 1.0;
          baseNormH = sourceAspect;
          baseNormX = 0.0;
          baseNormY = (1.0 - baseNormH) / 2.0;
        }

        cropWidth = Math.max(0.05, Math.min(baseNormW, baseNormW / scale));
        cropHeight = Math.max(0.05, Math.min(baseNormH, baseNormH / scale));

        const normOffsetX = currentOffset.current.x / (canvasSize * scale);
        const normOffsetY = currentOffset.current.y / (canvasSize * scale);

        cropX = Math.max(0, Math.min(1.0 - cropWidth, baseNormX + (baseNormW - cropWidth) / 2.0 - normOffsetX * baseNormW));
        cropY = Math.max(0, Math.min(1.0 - cropHeight, baseNormY + (baseNormH - cropHeight) / 2.0 - normOffsetY * baseNormH));
      } else if (scale > 1.01 || currentOffset.current.x !== 0 || currentOffset.current.y !== 0) {
        cropWidth = Math.max(0.1, Math.min(1.0, 1.0 / scale));
        cropHeight = Math.max(0.1, Math.min(1.0, 1.0 / scale));

        const normOffsetX = currentOffset.current.x / (canvasSize * scale);
        const normOffsetY = currentOffset.current.y / (canvasSize * scale);

        cropX = Math.max(0, Math.min(1.0 - cropWidth, (1.0 - cropWidth) / 2.0 - normOffsetX));
        cropY = Math.max(0, Math.min(1.0 - cropHeight, (1.0 - cropHeight) / 2.0 - normOffsetY));
      }

      const targetW = isProfile ? 512 : undefined;
      const targetH = isProfile ? 512 : undefined;

      const result = await imagePipeline.cropAndScaleImage(
        sourceUri,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        targetW,
        targetH,
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
  const imageAspectRatio = imgDimensions.width / (imgDimensions.height || 1);

  const CROP_CANVAS_WIDTH = Math.min(290, windowWidth - spacing.md * 2);
  const MAX_CROP_CANVAS_HEIGHT = 360;

  let cropBoxWidth = CROP_CANVAS_WIDTH;
  let cropBoxHeight = CROP_CANVAS_WIDTH;
  if (!isProfile) {
    const calcH = CROP_CANVAS_WIDTH / (imageAspectRatio || 1.777);
    if (calcH <= MAX_CROP_CANVAS_HEIGHT) {
      cropBoxWidth = CROP_CANVAS_WIDTH;
      cropBoxHeight = calcH;
    } else {
      cropBoxHeight = MAX_CROP_CANVAS_HEIGHT;
      cropBoxWidth = cropBoxHeight * (imageAspectRatio || 1.777);
      if (cropBoxWidth > CROP_CANVAS_WIDTH) {
        cropBoxWidth = CROP_CANVAS_WIDTH;
        cropBoxHeight = cropBoxWidth / (imageAspectRatio || 1.777);
      }
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isProcessing}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isProfile ? 'Frame Profile Picture' : 'Frame Presence Photo'}
          </Text>
          <TouchableOpacity onPress={handleApply} disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.applyText}>Use Photo</Text>
            )}
          </TouchableOpacity>
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
                ? 'Drag and zoom inside circle to frame profile avatar'
                : 'Pinch/Zoom or Drag to adjust optional status framing'}
            </Text>

            <View
              style={[
                styles.cropContainer,
                styles.cropBoxSelfCenter,
                { width: cropBoxWidth, height: cropBoxHeight },
                isProfile && styles.roundedCropContainer,
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
                    resizeMode={isProfile || scale > 1.01 ? 'cover' : 'contain'}
                  />
                </Animated.View>
              </View>

              {/* OVERLAY GUIDE GRID */}
              <View style={styles.overlayFrame} pointerEvents="none" />
            </View>

            {/* ZOOM CONTROLS */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setScale((s) => Math.max(1.0, s - 0.2))}
              >
                <Text style={styles.zoomBtnText}>🔍 -</Text>
              </TouchableOpacity>
              <Text style={styles.scaleText}>{scale.toFixed(1)}x</Text>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setScale((s) => Math.min(3.0, s + 0.2))}
              >
                <Text style={styles.zoomBtnText}>🔍 +</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>↺ Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DUAL REALTIME PREVIEW SECTION */}
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>PREVIEWS</Text>
            <View style={styles.previewsRow}>
              <LivePreviewCard
                label="📱 App Feed Card"
                isProfile={isProfile}
                sourceUri={sourceUri}
                currentOffset={currentOffset.current}
                scale={scale}
                imageAspectRatio={imageAspectRatio}
              />
              <LivePreviewCard
                label="🖼️ Polaroid Widget"
                isWidget
                isProfile={isProfile}
                sourceUri={sourceUri}
                currentOffset={currentOffset.current}
                scale={scale}
                imageAspectRatio={imageAspectRatio}
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
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
  },
  applyText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
    fontSize: typography.fontSizes.sm,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  workspace: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  instructionText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    marginBottom: spacing.xs,
  },
  cropContainer: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundedCropContainer: {
    borderRadius: borderRadius.round,
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  zoomBtn: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  zoomBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  scaleText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    minWidth: 36,
    textAlign: 'center',
  },
  resetBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  resetBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
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
  cropBoxSelfCenter: {
    alignSelf: 'center',
  },
  cropTouchArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default ImageEditorModal;
