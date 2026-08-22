import NetInfo from '@react-native-community/netinfo';
import syncEngine from './syncEngine';

let isListenerActive = false;

export const initNetworkSyncListener = () => {
  if (isListenerActive) return;
  isListenerActive = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('[NetInfoListener] Internet connectivity restored. Triggering syncEngine.syncAll()...');
      syncEngine.syncAll();
    }
  });
};

export default initNetworkSyncListener;
