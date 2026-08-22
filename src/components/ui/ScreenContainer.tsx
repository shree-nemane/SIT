import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/theme';

export interface ScreenContainerProps {
  children: React.ReactNode;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  backgroundColor?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  keyboardVerticalOffset?: number;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  edges = ['top', 'bottom'],
  scrollable = false,
  keyboardAvoiding = false,
  backgroundColor = colors.background,
  refreshControl,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
}) => {
  const insets = useSafeAreaInsets();

  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  };

  const renderContent = () => {
    if (scrollable) {
      return (
        <ScrollView
          style={[styles.flexOne, style]}
          contentContainerStyle={[styles.defaultContentContainer, contentContainerStyle]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      );
    }
    return (
      <View style={[styles.flexOne, styles.defaultContentContainer, contentContainerStyle, style]}>
        {children}
      </View>
    );
  };

  if (keyboardAvoiding) {
    return (
      <View style={containerStyle}>
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {renderContent()}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return <View style={containerStyle}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  defaultContentContainer: {
    paddingHorizontal: spacing.md, // 16px default side padding across all screens
  },
});

export default ScreenContainer;
