import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Alert,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { QuickStatusPill } from '../../components/presence/QuickStatusPill';
import { colors, spacing, typography, borderRadius } from '../../theme/theme';
import { usePresenceStore } from './presenceStore';
import { useAuthStore } from '../auth/authStore';
import PresenceRepository from '../../data/repositories/PresenceRepository';
import imagePipeline, { ProcessedImageResult } from '../media/imagePipeline';
import ImageEditorModal from '../media/ImageEditorModal';
import widgetSnapshotService from '../widget/widgetSnapshot';
import syncEngine from '../sync/syncEngine';
import { generateUUID } from '../../utils/uuid';
import { supabase } from '../../data/supabaseClient';

interface CheckInScreenProps {
  navigation: any;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({ navigation }) => {
  const { draftDescription, setDraftDescription, setMyPresence, resetDraft } =
    usePresenceStore();
  const { member, userId } = useAuthStore();

  const [selectedImage, setSelectedImage] = useState<ProcessedImageResult | null>(null);
  const [rawPickedUri, setRawPickedUri] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-crop photo directly without forcing crop screen (Law 10 / Minimal Effort)
  const handlePickPhoto = async (useCamera: boolean = false) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await imagePipeline.pickImage(useCamera);
      if (result) {
        setRawPickedUri(result.localPath);
        // Auto crop by default to skip forced modal step
        const autoCropped = await imagePipeline.cropAndScaleImage(
          result.localPath,
          0,
          0,
          1.0,
          1.0,
          undefined,
          undefined,
          result.width,
          result.height
        );
        setSelectedImage(autoCropped || result);
      }
    } catch (err: any) {
      if (__DEV__) {
        console.log('[CheckInScreen] Photo selection failed:', err);
      }
      Alert.alert('Photo Error', 'Could not select or process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeCheckIn = async (textDescription: string, imageResult: ProcessedImageResult | null) => {
    if (!textDescription.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      let activeUserId = member?.id || userId;
      if (!activeUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          activeUserId = session.user.id;
        } else {
          Alert.alert('Authentication Error', 'Session lost. Please sign in again.');
          return;
        }
      }

      const presenceId = generateUUID();
      const nowIso = new Date().toISOString();

      const newPresence = {
        id: presenceId,
        memberId: activeUserId,
        description: textDescription.trim(),
        imageId: imageResult ? imageResult.localPath : null,
        updatedAt: nowIso,
        syncStatus: 'pending' as const,
      };

      const syncPayload = JSON.stringify({
        presenceId,
        memberId: activeUserId,
        description: textDescription.trim(),
        imageLocalPath: imageResult ? imageResult.localPath : null,
        imageWidth: imageResult ? imageResult.width : undefined,
        imageHeight: imageResult ? imageResult.height : undefined,
        updatedAt: nowIso,
      });

      const syncOp = {
        id: `sync_${Date.now()}`,
        entityType: 'presence' as const,
        entityId: presenceId,
        operation: 'UPDATE' as const,
        payload: syncPayload,
        createdAt: nowIso,
      };

      const success = await PresenceRepository.saveCheckInTransaction(newPresence, syncOp);

      if (success) {
        setMyPresence(newPresence);
        await widgetSnapshotService.updateAndNotifyWidget();
        syncEngine.syncAll();
        resetDraft();
        navigation.navigate('MainApp', {
          screen: 'Today',
          params: {
            showUndoToast: true,
            undoPresenceId: presenceId,
            undoMemberId: activeUserId,
            undoStatusText: textDescription.trim(),
          },
        });
      } else {
        Alert.alert('Check In Error', 'Could not save check-in locally. Please try again.');
      }
    } catch (err: any) {
      if (__DEV__) {
        console.log('[CheckInScreen] Check-in transaction error:', err);
      }
      Alert.alert('Check In Failed', 'An unexpected error occurred while saving your check-in.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 1-Tap Quick Check-In (Minimal Effort)
   * Tapping a status pill immediately submits the status in 1 tap with chip-level idempotency locking.
   */
  const handleSelectQuickStatus = (statusText: string) => {
    if (isProcessing) return;
    setDraftDescription(statusText);
    executeCheckIn(statusText, selectedImage);
  };

  const handleManualSave = () => {
    executeCheckIn(draftDescription, selectedImage);
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} keyboardAvoiding scrollable style={styles.container}>
      {/* TOP NAVIGATION BAR */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isProcessing}
          activeOpacity={0.7}
          style={styles.navBarSideBtn}
        >
          <Text style={styles.cancelNavText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.navBarTitle}>Check In</Text>

        <View style={styles.navBarSideRight} />
      </View>

      {/* 1. QUICK STATUS PRESET SUGGESTIONS (FRONT & CENTER - 1 TAP PATH WITH IDEMPOTENCY LOCKING) */}
      <Card variant="default" style={styles.quickStatusCard}>
        <QuickStatusPill onSelectStatus={handleSelectQuickStatus} disabled={isProcessing} />
      </Card>

      {/* 2. OPTIONAL "SAY MORE" EXPANSION SECTION */}
      <Card variant="default" style={styles.composerCard}>
        <Text style={styles.sayMoreLabel}>SAY MORE (OPTIONAL)</Text>

        <Input
          placeholder="Add a note..."
          multiline
          maxLength={280}
          value={draftDescription}
          onChangeText={setDraftDescription}
          containerStyle={styles.inputWrapper}
          inputStyle={styles.inputStyle}
        />

        {/* ATTACHED PHOTO PREVIEW */}
        {selectedImage && (
          <View style={styles.imagePreviewWrapper}>
            <Image
              source={{ uri: selectedImage.localPath }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <View style={styles.imageActionsOverlay}>
              <TouchableOpacity
                style={styles.adjustFramingBtn}
                onPress={() => setEditorVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.adjustFramingText}>📐 Adjust framing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.removeImageText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MEDIA ATTACH BUTTONS */}
        <View style={styles.mediaButtonsRow}>
          <Button
            title="📷 Photo"
            onPress={() => handlePickPhoto(true)}
            variant="secondary"
            size="sm"
            disabled={isProcessing}
            style={styles.flexHalf}
          />
          <Button
            title="🖼️ Gallery"
            onPress={() => handlePickPhoto(false)}
            variant="secondary"
            size="sm"
            disabled={isProcessing}
            style={styles.flexHalf}
          />
        </View>
      </Card>

      {/* PRIMARY UNIFIED UNAMBIGUOUS ACTION */}
      <View style={styles.actionSection}>
        <Button
          title="Check In"
          onPress={handleManualSave}
          variant="primary"
          size="lg"
          isLoading={isProcessing}
          disabled={!draftDescription.trim() || isProcessing}
          style={styles.saveBtn}
        />
      </View>

      <ImageEditorModal
        visible={editorVisible}
        mode="PRESENCE"
        sourceUri={rawPickedUri}
        onClose={() => setEditorVisible(false)}
        onApply={(result) => {
          setSelectedImage(result);
          setEditorVisible(false);
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  navBarSideBtn: {
    minWidth: 60,
  },
  cancelNavText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.weights.medium,
  },
  navBarTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.weights.bold,
  },
  navBarSideRight: {
    minWidth: 60,
  },
  quickStatusCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  composerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sayMoreLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    marginBottom: spacing.xs,
  },
  inputStyle: {
    minHeight: 80,
    fontSize: typography.fontSizes.md,
    textAlignVertical: 'top',
    lineHeight: typography.lineHeights.md,
  },
  imagePreviewWrapper: {
    marginVertical: spacing.sm,
    position: 'relative',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
  },
  imageActionsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adjustFramingBtn: {
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: borderRadius.round,
  },
  adjustFramingText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xs,
  },
  removeImageBtn: {
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: borderRadius.round,
  },
  removeImageText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xs,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flexHalf: {
    flex: 1,
  },
  actionSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  saveBtn: {
    width: '100%',
  },
});

export default CheckInScreen;
