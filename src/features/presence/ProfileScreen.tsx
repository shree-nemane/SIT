import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { WidgetGuideCard } from '../../components/widget/WidgetGuideCard';
import { colors, spacing, typography, borderRadius } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import MemberRepository from '../../data/repositories/MemberRepository';
import imagePipeline, { ProcessedImageResult } from '../media/imagePipeline';
import ImageEditorModal from '../media/ImageEditorModal';
import syncEngine from '../sync/syncEngine';

export const ProfileScreen: React.FC = () => {
  const { member, userId, signOut, initializeAuth } = useAuthStore();
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

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim() || !activeUserId) return;
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
      Alert.alert('Profile Updated', 'Your profile changes have been saved locally.');
    } else {
      Alert.alert('Error', 'Failed to update profile locally.');
    }
    setIsSavingProfile(false);
  };

  const activeAvatarPath = selectedProfileImage
    ? selectedProfileImage.localPath
    : currentLocalAvatar;

  return (
    <ScreenContainer edges={['top']} scrollable contentContainerStyle={styles.scrollContent}>
      <View style={styles.padding}>
        {/* CUSTOM RESPONSIVE PAGE DISPLAY HEADER */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>You</Text>
          <Text style={styles.greetingText}>Your presence profile & account</Text>
        </View>

        {/* AVATAR HERO ZONE - NOT A CARD (HERO TINTED CONTAINER) */}
        <View style={styles.avatarHeroZone}>
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
        </View>

        {/* WIDGET INSTALLATION GUIDE CARD */}
        <WidgetGuideCard />

        {/* SIGN OUT ACTION - DIRECT BUTTON (CARD-REDUCED) */}
        <Button
          title="Sign Out of Account"
          onPress={signOut}
          variant="destructive"
          size="md"
          style={styles.signOutBtn}
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
    // Rely on ScreenContainer default 16px side padding
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  appTitle: {
    color: colors.primary,
    fontSize: typography.fontSizes.display,
    fontWeight: typography.weights.heavy,
    letterSpacing: -0.5,
  },
  greetingText: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.md,
    marginTop: spacing.xxs,
  },
  avatarHeroZone: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
    borderRadius: borderRadius.lg,
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
  signOutBtn: {
    width: '100%',
    marginTop: spacing.sm,
  },
});

export default ProfileScreen;
