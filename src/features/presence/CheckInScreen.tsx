import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { QuickStatusPill } from '../../components/presence/QuickStatusPill';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/theme';
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

  const handlePickPhoto = async (useCamera: boolean = false) => {
    setIsProcessing(true);
    const result = await imagePipeline.pickImage(useCamera);
    if (result) {
      setRawPickedUri(result.localPath);
      setEditorVisible(true);
    }
    setIsProcessing(false);
  };

  const handleSave = async () => {
    if (!draftDescription.trim()) return;

    setIsProcessing(true);
    let activeUserId = member?.id || userId;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        activeUserId = session.user.id;
      } else {
        setIsProcessing(false);
        return;
      }
    }

    const presenceId = generateUUID();
    const nowIso = new Date().toISOString();

    const newPresence = {
      id: presenceId,
      memberId: activeUserId,
      description: draftDescription.trim(),
      imageId: selectedImage ? selectedImage.localPath : null,
      updatedAt: nowIso,
      syncStatus: 'pending' as const,
    };

    const syncPayload = JSON.stringify({
      presenceId,
      memberId: activeUserId,
      description: draftDescription.trim(),
      imageLocalPath: selectedImage ? selectedImage.localPath : null,
      imageWidth: selectedImage ? selectedImage.width : undefined,
      imageHeight: selectedImage ? selectedImage.height : undefined,
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
      navigation.goBack();
    }
    setIsProcessing(false);
  };

  const handleSelectQuickStatus = (statusText: string) => {
    if (!draftDescription.trim()) {
      setDraftDescription(statusText);
    } else {
      setDraftDescription(`${draftDescription} ${statusText}`);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} keyboardAvoiding scrollable style={styles.container}>
      {/* SOPHISTICATED TOP NAVIGATION BAR */}
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

      {/* HERO COMPOSER CARD */}
      <Card variant="elevated" style={styles.composerCard}>
        <Input
          placeholder="What are you up to right now?"
          multiline
          maxLength={280}
          value={draftDescription}
          onChangeText={setDraftDescription}
          autoFocus
          containerStyle={styles.inputWrapper}
          inputStyle={styles.inputStyle}
        />

        {/* ATTACHED PHOTO PREVIEW CARD */}
        {selectedImage && (
          <View style={styles.imagePreviewWrapper}>
            <Image
              source={{ uri: selectedImage.localPath }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.removeImagePill}
              onPress={() => setSelectedImage(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.removeImagePillText}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* QUICK STATUS PRESET SUGGESTIONS */}
        <QuickStatusPill onSelectStatus={handleSelectQuickStatus} />
      </Card>

      {/* ATTACHMENT TOOLBAR CHIPS */}
      <View style={styles.mediaToolbarSection}>
        <Text style={styles.mediaToolbarLabel}>ATTACH MEDIA</Text>
        <View style={styles.mediaButtonsRow}>
          <Button
            title="📷 Take Photo"
            onPress={() => handlePickPhoto(true)}
            variant="secondary"
            size="sm"
            disabled={isProcessing}
            style={styles.flexHalf}
          />
          <Button
            title="🖼️ From Gallery"
            onPress={() => handlePickPhoto(false)}
            variant="secondary"
            size="sm"
            disabled={isProcessing}
            style={styles.flexHalf}
          />
        </View>
      </View>

      {/* PRIMARY SAVE ACTION */}
      <View style={styles.actionSection}>
        <Button
          title="Save Presence"
          onPress={handleSave}
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
    // Rely on ScreenContainer default 16px side padding
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
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
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.weights.bold,
  },
  navBarSideRight: {
    minWidth: 60,
  },
  composerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    marginBottom: spacing.xs,
  },
  inputStyle: {
    minHeight: 120,
    fontSize: typography.fontSizes.md,
    textAlignVertical: 'top',
    lineHeight: typography.lineHeights.md,
  },
  imagePreviewWrapper: {
    marginVertical: spacing.sm,
    position: 'relative',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
  },
  removeImagePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: borderRadius.round,
  },
  removeImagePillText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.weights.medium,
  },
  mediaToolbarSection: {
    marginBottom: spacing.md,
  },
  mediaToolbarLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    ...shadows.fab,
  },
});

export default CheckInScreen;
