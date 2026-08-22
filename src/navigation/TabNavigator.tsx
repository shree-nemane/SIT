import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { HomeScreen } from '../features/presence/HomeScreen';
import { GroupScreen } from '../features/presence/GroupScreen';
import { ProfileScreen } from '../features/presence/ProfileScreen';
import { colors, typography, shadows, spacing } from '../theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const VectorIcon: React.FC<{ name: 'feed' | 'circle' | 'you'; focused: boolean }> = ({ name, focused }) => {
  const iconColor = focused ? colors.primary : colors.textMuted;

  if (name === 'feed') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.feedBarWide, { backgroundColor: iconColor }]} />
        <View style={[styles.feedBarNarrow, { backgroundColor: iconColor }]} />
        <View style={[styles.feedBarWide, { backgroundColor: iconColor }]} />
      </View>
    );
  }

  if (name === 'circle') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.circleRing, { borderColor: iconColor }]} />
        <View style={[styles.circleCenterDot, { backgroundColor: iconColor }]} />
      </View>
    );
  }

  return (
    <View style={styles.iconBox}>
      <View style={[styles.userHead, { backgroundColor: iconColor }]} />
      <View style={[styles.userBody, { borderColor: iconColor }]} />
    </View>
  );
};

const TabItem: React.FC<{ name: 'feed' | 'circle' | 'you'; label: string; focused: boolean }> = ({
  name,
  label,
  focused,
}) => {
  return (
    <View style={styles.tabItemContainer}>
      <VectorIcon name={name} focused={focused} />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused ? <View style={styles.activeDot} /> : <View style={styles.activeDotPlaceholder} />}
    </View>
  );
};

const renderFeedTabIcon = ({ focused }: { focused: boolean }) => (
  <TabItem name="feed" label="Feed" focused={focused} />
);

const renderCircleTabIcon = ({ focused }: { focused: boolean }) => (
  <TabItem name="circle" label="Circle" focused={focused} />
);

const renderYouTabIcon = ({ focused }: { focused: boolean }) => (
  <TabItem name="you" label="You" focused={focused} />
);

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom, spacing.xs);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderTopWidth: 0,
          height: 62,
          marginHorizontal: 16,
          marginBottom: bottomMargin,
          paddingTop: 12,
          borderRadius: 20,
          position: 'absolute',
          ...shadows.tabBar,
        },
        tabBarShowLabel: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={HomeScreen}
        options={{
          tabBarIcon: renderFeedTabIcon,
        }}
      />
      <Tab.Screen
        name="Group"
        component={GroupScreen}
        options={{
          title: 'Your Circle',
          tabBarIcon: renderCircleTabIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'You',
          tabBarIcon: renderYouTabIcon,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabItemContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedBarWide: {
    width: 16,
    height: 2.5,
    marginBottom: 2.5,
    borderRadius: 1.5,
  },
  feedBarNarrow: {
    width: 11,
    height: 2.5,
    marginBottom: 2.5,
    borderRadius: 1.5,
  },
  circleRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },
  userHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  userBody: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSizes.xxs,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  activeDotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
});

export default TabNavigator;
