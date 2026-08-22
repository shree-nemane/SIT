import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { CheckInScreen } from '../features/presence/CheckInScreen';
import { AuthScreen } from '../features/auth/AuthScreen';
import { JoinGroupScreen } from '../features/auth/JoinGroupScreen';
import { SplashScreen } from '../components/SplashScreen';
import { useAuthStore } from '../features/auth/authStore';
import { colors } from '../theme/theme';

import realtimeSyncListener from '../features/sync/realtimeSyncListener';

const Stack = createNativeStackNavigator<RootStackParamList>();

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

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
