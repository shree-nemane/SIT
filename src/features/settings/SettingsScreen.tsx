import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Switch, TouchableOpacity, Linking } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { WidgetGuideCard } from '../../components/widget/WidgetGuideCard';
import Text from '../../components/ui/Text';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useAuthStore } from '../auth/authStore';
import useNotificationPreferencesStore from '../notifications/notificationPreferencesStore';
import pushService from '../notifications/pushService';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { signOut } = useAuthStore();
  const { notificationsEnabled, setNotificationsEnabled } = useNotificationPreferencesStore();
  const [widgetExpanded, setWidgetExpanded] = useState(false);
  const [osPermissionGranted, setOsPermissionGranted] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkPermission = async () => {
      const granted = await pushService.checkOSNotificationPermission();
      if (isMounted) setOsPermissionGranted(granted);
    };
    checkPermission();

    const unsubscribe = navigation.addListener('focus', () => {
      checkPermission();
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigation]);

  const handleOpenAppSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  return (
    <ScreenContainer edges={['top']} scrollable contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        {/* EYEBROW PAGE HEADER */}
        <View style={styles.header}>
          <Text variant="micro" style={styles.eyebrowTitle}>SETTINGS</Text>
          <Text variant="h2" style={styles.pageTitle}>Preferences & Account</Text>
        </View>

        {/* 1. NOTIFICATION PREFERENCES ("SILENCE IS A FEATURE") */}
        <Card variant="default" style={styles.sectionCard}>
          <Text variant="label" style={styles.sectionTitle}>NOTIFICATION PREFERENCES</Text>
          <Text variant="bodySmall" style={styles.sectionSub}>
            Silence is a feature. Control how quietly Stay in Touch speaks to you.
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text variant="subtitle" style={styles.toggleTitle}>Circle Check-in Alerts</Text>
              <Text variant="micro" style={styles.toggleSub}>
                {notificationsEnabled
                  ? 'Get a notification when someone in your circle checks in.'
                  : 'Quiet mode — Your circle continues syncing silently in the background.'}
              </Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>

          {/* OS PERMISSION DENIED WARNING BANNER */}
          {notificationsEnabled && !osPermissionGranted && (
            <View style={styles.permissionWarningBanner}>
              <Text variant="subtitle" style={styles.warningTitle}>⚠ Notifications are blocked</Text>
              <Text variant="micro" style={styles.warningText}>
                SIT alerts are enabled, but your phone is currently preventing notifications.
              </Text>
              <TouchableOpacity
                style={styles.openSettingsBtn}
                onPress={handleOpenAppSettings}
                activeOpacity={0.8}
              >
                <Text variant="label" style={styles.openSettingsText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* 2. WIDGET SETUP (COLLAPSED BY DEFAULT PER LAW 10 & LAW 36) */}
        <Card variant="default" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setWidgetExpanded(!widgetExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionTitleRow}>
              <Text variant="subtitle" style={styles.accordionTitle}>Home Screen Widget</Text>
              <Text variant="micro" style={styles.accordionArrow}>
                {widgetExpanded ? '▲ Hide' : '▼ Add widget →'}
              </Text>
            </View>
          </TouchableOpacity>

          {widgetExpanded && (
            <View style={styles.accordionBody}>
              <WidgetGuideCard />
            </View>
          )}
        </Card>

        {/* 3. ACCOUNT & PRIVACY */}
        <Card variant="default" style={styles.sectionCard}>
          <Text variant="label" style={styles.sectionTitle}>PRIVACY & ACCOUNT</Text>
          <Text variant="bodySmall" style={styles.sectionSub}>
            Your presence data is end-to-end private to your circle.
          </Text>

          <Button
            title="Sign Out of Account"
            onPress={signOut}
            variant="destructive"
            size="md"
            style={styles.signOutBtn}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    padding: spacing.md,
  },
  header: {
    marginTop: spacing.sm,
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
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  sectionSub: {
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleTextGroup: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    color: colors.textPrimary,
  },
  toggleSub: {
    color: colors.textMuted,
    marginTop: 2,
  },
  permissionWarningBanner: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.syncError,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  warningTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  warningText: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  openSettingsBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorderLight,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: borderRadius.sm,
  },
  openSettingsText: {
    color: colors.primary,
  },
  accordionHeader: {
    paddingVertical: spacing.xs,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionTitle: {
    color: colors.textPrimary,
  },
  accordionArrow: {
    color: colors.textMuted,
  },
  accordionBody: {
    marginTop: spacing.md,
  },
  signOutBtn: {
    marginTop: spacing.xs,
  },
});

export default SettingsScreen;
