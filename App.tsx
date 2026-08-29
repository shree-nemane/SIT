import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from './src/app/QueryClientProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/components/SplashScreen';
import { initDatabase } from './src/database/db';
import { initNetworkSyncListener } from './src/features/sync/netInfoListener';
import { colors } from './src/theme/theme';
import { useAuthStore } from './src/features/auth/authStore';
import { useNotificationPreferencesStore } from './src/features/notifications/notificationPreferencesStore';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    // 1. Early restore of notification preferences
    useNotificationPreferencesStore.getState().loadPreferences();

    // 2. Ordered Startup Sequence: Database initialization -> Auth & Member resolution
    initDatabase()
      .then(() => {
        setIsDbReady(true);
        initNetworkSyncListener();
        // 3. Initialize Auth bootstrap strictly after SQLite is ready (schedulePostBootstrapWork handles sync)
        initializeAuth();
      })
      .catch((err) => {
        if (__DEV__) {
          console.log('[App] Database initialization warning:', err);
        }
        setIsDbReady(true);
        initializeAuth();
      });
  }, [initializeAuth]);

  // Single Authoritative Startup Readiness Condition
  const isAppReady = isDbReady && isAuthInitialized;

  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <SafeAreaProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor={colors.background}
          />
          {isAppReady ? <RootNavigator /> : <SplashScreen />}
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
