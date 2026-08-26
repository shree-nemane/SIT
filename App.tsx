import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from './src/app/QueryClientProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/components/SplashScreen';
import { initDatabase } from './src/database/db';
import { initNetworkSyncListener } from './src/features/sync/netInfoListener';
import { syncEngine } from './src/features/sync/syncEngine';
import { colors } from './src/theme/theme';

import { useNotificationPreferencesStore } from './src/features/notifications/notificationPreferencesStore';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // Early restore of notification preferences
    useNotificationPreferencesStore.getState().loadPreferences();

    // 1. Initialize local SQLite database schema first
    initDatabase()
      .then(() => {
        setIsDbReady(true);
        // 2. Initialize network listener & trigger startup sync
        initNetworkSyncListener();
        syncEngine.syncAll();
      })
      .catch((err) => {
        console.error('[App] Database initialization error:', err);
        setIsDbReady(true);
      });
  }, []);

  if (!isDbReady) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <SafeAreaProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor={colors.background}
          />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
