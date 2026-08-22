import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from './src/app/QueryClientProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/database/db';
import { initNetworkSyncListener } from './src/features/sync/netInfoListener';
import { syncEngine } from './src/features/sync/syncEngine';
import { colors } from './src/theme/theme';

function App() {
  useEffect(() => {
    // 1. Initialize local SQLite database
    initDatabase().then(() => {
      // 2. Initialize network listener & trigger startup sync
      initNetworkSyncListener();
      syncEngine.syncAll();
    });
  }, []);

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
