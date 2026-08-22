import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography, shadows } from '../../theme/theme';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmTitle?: string;
  cancelTitle?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  style?: ViewStyle;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
  style,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onCancel} accessibilityLabel="Close dialog overlay">
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dialogCard, style]}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Text style={styles.message} accessibilityLiveRegion="polite">
                {message}
              </Text>

              <View style={styles.buttonColumn}>
                <Button
                  title={confirmTitle}
                  onPress={onConfirm}
                  variant={isDestructive ? 'destructive' : 'primary'}
                  size="md"
                  isLoading={isLoading}
                  disabled={isLoading}
                  style={styles.confirmButton}
                />

                <Button
                  title={cancelTitle}
                  onPress={onCancel}
                  variant="ghost"
                  size="md"
                  disabled={isLoading}
                  style={styles.cancelButton}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 0,
    ...shadows.cardElevated,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  buttonColumn: {
    width: '100%',
    gap: spacing.xs,
    flexDirection : "row-reverse"
  },
  confirmButton: {
    width: '50%',
  },
  cancelButton: {
    width: '50%',
  },
});

export default ConfirmModal;
