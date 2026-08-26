import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Alert,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import Text from '../../components/ui/Text';
import { colors, spacing } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import MemberRepository from '../../data/repositories/MemberRepository';
import imagePipeline, { ProcessedImageResult } from '../media/imagePipeline';
import ImageEditorModal from '../media/ImageEditorModal';
import syncEngine from '../sync/syncEngine';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { member, userId, initializeAuth } = useAuthStore();
  const activeUserId = member?.id || userId;

  const [editDisplayName, setEditDisplayName] = useState('');
  const [currentLocalAvatar, setCurrentLocalAvatar] = useState<string | null>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<ProcessedImageResult | null>(null);
  const [rawProfileUri, setRawProfileUri] = useState<string | null>(null);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const loadLocalProfile = useCallback(async () => {
    if (activeUserId) {
      const localProf = await MemberRepository.getMember(activeUserId);
      setEditDisplayName(localProf?.displayName || member?.displayName || '');
      setCurrentLocalAvatar(localProf?.profileImageLocalPath || member?.profileImageId || null);
    } else {
      setEditDisplayName(member?.displayName || '');
      setCurrentLocalAvatar(member?.profileImageId || null);
    }
    setSelectedProfileImage(null);
  }, [activeUserId, member]);

  useEffect(() => {
    loadLocalProfile();
  }, [loadLocalProfile]);

  const handlePickProfilePhoto = async (useCamera: boolean) => {
    const result = await imagePipeline.pickImage(useCamera);
    if (result) {
      setRawProfileUri(result.localPath);
      setProfileEditorVisible(true);
    }
  };

  /**
   * Idempotent Save Handler (Law 24):
   * Disables button immediately on submit to prevent double-taps or repeat submissions.
   */
  const handleSaveProfile = async () => {
    if (!editDisplayName.trim() || !activeUserId || isSavingProfile) return;
    setIsSavingProfile(true);

    const profilePath = selectedProfileImage
      ? selectedProfileImage.localPath
      : currentLocalAvatar;

    const ok = await MemberRepository.updateMemberProfileTransaction(
      activeUserId,
      editDisplayName.trim(),
      profilePath
    );

    if (ok) {
      await initializeAuth();
      syncEngine.syncAll();
      Alert.alert('Profile Saved', 'Your identity has been updated.');
    } else {
      Alert.alert('Error', 'Failed to save profile changes.');
    }
    setIsSavingProfile(false);
  };

  const activeAvatarPath = selectedProfileImage
    ? selectedProfileImage.localPath
    : currentLocalAvatar;

  return (
    <ScreenContainer edges={['top']} scrollable contentContainerStyle={styles.scrollContent}>
      <View style={styles.padding}>
        {/* EYEBROW PAGE HEADER */}
        <View style={styles.header}>
          <Text variant="micro" style={styles.eyebrowTitle}>YOU</Text>
          <Text variant="h2" style={styles.pageTitle}>Identity</Text>
        </View>

        {/* IDENTITY CONTAINER (PURE IDENTITY FOCUS) */}
        <Card variant="default" style={styles.identityCard}>
          <Avatar
            uri={activeAvatarPath}
            name={editDisplayName || member?.displayName}
            size="xl"
            style={styles.avatarMargin}
          />

          <View style={styles.photoActionsRow}>
            <Button
              title="📷 Camera"
              onPress={() => handlePickProfilePhoto(true)}
              variant="secondary"
              size="sm"
            />
            <Button
              title="🖼️ Gallery"
              onPress={() => handlePickProfilePhoto(false)}
              variant="secondary"
              size="sm"
            />
          </View>

          <Input
            label="DISPLAY NAME"
            value={editDisplayName}
            onChangeText={setEditDisplayName}
            placeholder="Your Name"
            containerStyle={styles.inputContainer}
          />

          <Button
            title="Save Profile"
            onPress={handleSaveProfile}
            variant="primary"
            size="md"
            isLoading={isSavingProfile}
            disabled={!editDisplayName.trim() || isSavingProfile}
            style={styles.saveBtn}
          />
        </Card>

        {/* SINGLE CLEAN LINK OUT TO SETTINGS SCREEN */}
        <Button
          title="⚙️ Settings & Preferences →"
          onPress={() => navigation.navigate('Settings')}
          variant="secondary"
          size="md"
          style={styles.settingsLinkBtn}
        />
      </View>

      <ImageEditorModal
        visible={profileEditorVisible}
        mode="PROFILE"
        sourceUri={rawProfileUri}
        onClose={() => setProfileEditorVisible(false)}
        onApply={(result) => {
          setSelectedProfileImage(result);
          setProfileEditorVisible(false);
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 90,
  },
  padding: {
    padding: spacing.md,
  },
  header: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  eyebrowTitle: {
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  pageTitle: {
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  identityCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarMargin: {
    marginBottom: spacing.md,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  saveBtn: {
    width: '100%',
  },
  settingsLinkBtn: {
    width: '100%',
    marginTop: spacing.xs,
  },
});

export default ProfileScreen;
