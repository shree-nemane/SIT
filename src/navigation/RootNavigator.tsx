import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { CheckInScreen } from '../features/presence/CheckInScreen';
import { AuthScreen } from '../features/auth/AuthScreen';
import { JoinGroupScreen } from '../features/auth/JoinGroupScreen';
import { SplashScreen } from '../components/SplashScreen';
import { useAuthStore } from '../features/auth/authStore';
import { colors } from '../theme/theme';
import notificationNavigation from '../features/notifications/notificationNavigation';

import realtimeSyncListener from '../features/sync/realtimeSyncListener';

import { SettingsScreen } from '../features/settings/SettingsScreen';
import { MemberDetailScreen } from '../features/presence/MemberDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const RootNavigator = () => {
  const { authStatus, membershipStatus, isLoading, initializeAuth } =
    useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (authStatus === 'signed_in' && membershipStatus === 'member') {
      realtimeSyncListener.startListening();
    } else {
      realtimeSyncListener.stopListening();
    }
    return () => {
      realtimeSyncListener.stopListening();
    };
  }, [authStatus, membershipStatus]);

  // Restore pending navigation from AsyncStorage on cold start
  useEffect(() => {
    notificationNavigation.loadStoredDestination();
  }, []);

  // Handle pending notification tap navigation safely after auth resolution & navigator ready
  useEffect(() => {
    const isAuthResolved = authStatus === 'signed_in' && membershipStatus === 'member' && !isLoading;
    if (isAuthResolved) {
      const checkAndNavigate = () => {
        if (navigationRef.isReady() && notificationNavigation.hasPendingDestination()) {
          const pending = notificationNavigation.consumePendingDestination();
          if (pending) {
            const dest = pending.destination;
            if (dest === 'Group' || dest === 'Profile') {
              (navigationRef as any).navigate('MainApp', { screen: dest });
            } else if (dest === 'CheckIn' || dest === 'Settings') {
              (navigationRef as any).navigate(dest);
            } else {
              (navigationRef as any).navigate('MainApp', { screen: 'Today' });
            }
          }
        }
      };

      checkAndNavigate();
    }
  }, [authStatus, membershipStatus, isLoading]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {authStatus === 'signed_out' ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : membershipStatus === 'no_group' ? (
          <Stack.Screen
            name="JoinGroup"
            component={JoinGroupScreen}
            options={{ title: 'Join Group', headerBackVisible: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainApp"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CheckIn"
              component={CheckInScreen}
              options={{ title: 'Check In', headerBackTitle: 'Back', headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings', headerShown: false }}
            />
            <Stack.Screen
              name="MemberDetail"
              component={MemberDetailScreen}
              options={{ title: 'Member Detail', headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
