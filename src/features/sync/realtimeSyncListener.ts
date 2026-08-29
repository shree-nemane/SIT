import { AppState, AppStateStatus } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../data/supabaseClient';
import syncEngine from './syncEngine';

let realtimeChannel: RealtimeChannel | null = null;
let appStateSubscription: any = null;

export const realtimeSyncListener = {
  /**
   * Initialize Supabase Realtime channel subscription tied to AppState lifecycle.
   * Listens to INSERT, UPDATE, DELETE events on public.presences and triggers syncEngine.syncAll().
   */
  startListening(): void {
    if (appStateSubscription) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // console.log('[RealtimeSync] App foregrounded. Subscribing to Realtime postgres changes...');
        realtimeSyncListener.subscribe();
        // Immediately sync on foreground
        syncEngine.syncAll();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // console.log('[RealtimeSync] App backgrounded. Unsubscribing from Realtime WebSocket...');
        realtimeSyncListener.unsubscribe();
      }
    };

    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Initial subscription if app is already active
    if (AppState.currentState === 'active') {
      realtimeSyncListener.subscribe();
    }
  },

  /**
   * Subscribe to Supabase Realtime postgres_changes on presences AND members tables
   */
  subscribe(): void {
    if (realtimeChannel) return;

    realtimeChannel = supabase
      .channel('public:presence_and_members')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presences' },
        (payload) => {
          // console.log(`[RealtimeSync] Presences change detected (${payload.eventType}). Triggering syncEngine.syncAll()...`);
          syncEngine.syncAll();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        (payload) => {
          // console.log(`[RealtimeSync] Members change detected (${payload.eventType}). Triggering syncEngine.syncAll()...`);
          syncEngine.syncAll();
        }
      )
      .subscribe((status) => {
        // console.log(`[RealtimeSync] Channel status: ${status}`);
      });
  },

  /**
   * Unsubscribe and clean up WebSocket connection
   */
  unsubscribe(): void {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  },

  /**
   * Completely stop listener and AppState subscription
   */
  stopListening(): void {
    realtimeSyncListener.unsubscribe();
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },
};

export default realtimeSyncListener;
