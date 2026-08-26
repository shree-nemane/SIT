import { create } from 'zustand';
import { Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthStatus, MembershipStatus, UserMember } from './types';
import { supabase } from '../../data/supabaseClient';
import { api } from '../../data/api';
import MemberRepository from '../../data/repositories/MemberRepository';
import syncEngine from '../sync/syncEngine';
import pushService from '../notifications/pushService';

export const parseAndValidateAuthUrl = (url: string | null | undefined): Record<string, string> | null => {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    // 1. Strict Protocol Validation
    if (parsed.protocol !== 'sit:') return null;

    // 2. Strict Host Validation
    if (parsed.hostname !== 'auth') return null;

    // 3. Strict Path Validation (/callback or /callback/)
    const normPath = parsed.pathname.replace(/\/+$/, '');
    if (normPath !== '/callback') return null;

    const params: Record<string, string> = {};

    const safelistAssign = (key: string, value: string) => {
      if (
        key &&
        !key.includes('__proto__') &&
        !key.includes('constructor') &&
        !key.includes('prototype')
      ) {
        params[key] = value;
      }
    };

    // 4. Extract Query Parameters (?code=...)
    if (parsed.search) {
      const searchParams = new URLSearchParams(parsed.search);
      searchParams.forEach((value, key) => safelistAssign(key, value));
    }

    // 5. Extract Hash Fragment Parameters (#access_token=... or #code=...)
    if (parsed.hash) {
      const hashStr = parsed.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashStr);
      hashParams.forEach((value, key) => safelistAssign(key, value));
    }

    // Require code parameter OR access_token + refresh_token
    if (!params.code && (!params.access_token || !params.refresh_token)) {
      return null;
    }

    return params;
  } catch {
    return null;
  }
};

interface AuthStore {
  authStatus: AuthStatus;
  membershipStatus: MembershipStatus;
  userEmail: string | null;
  userId: string | null;
  member: UserMember | null;
  groupName: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeAuth: () => Promise<void>;
  createGroup: (groupName: string, displayName: string) => Promise<boolean>;
  joinGroup: (code: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setError: (err: string | null) => void;
}

let isDeepLinkListenerRegistered = false;
let isExplicitSigningOut = false;

const handleSessionUpdate = async (
  set: (state: Partial<AuthStore>) => void,
  get: () => AuthStore,
  session: any,
  event?: string
) => {
  if (!session || !session.user) {
    // Guard against Supabase firing SIGNED_OUT due to TOKEN_REFRESH_FAILED while offline.
    // If we have no network AND we still have a locally-known userId, AND this is NOT an explicit user sign-out, keep the user signed in.
    // The session will be refreshed automatically when connectivity is restored.
    if (!isExplicitSigningOut && (event === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT')) {
      const netState = await NetInfo.fetch();
      const isOffline = !netState.isConnected || !netState.isInternetReachable;
      const currentUserId = get().userId;

      if (isOffline && currentUserId) {
        console.log(
          '[AuthStore] Token refresh failed while offline. Keeping session alive — will retry when network is restored.'
        );
        // Do not sign out. The autoRefreshToken will succeed once connectivity is back.
        return;
      }
    }

    set({
      authStatus: 'signed_out',
      membershipStatus: 'no_group',
      userId: null,
      userEmail: null,
      member: null,
      groupName: null,
      isLoading: false,
    });
    return;
  }

  const userId = session.user.id;
  const userEmail = session.user.email || null;

  // Asynchronously register FCM device token without blocking auth, navigation, or sync
  pushService.registerCurrentDeviceToken(userId).catch((pushErr) => {
    if (__DEV__) {
      console.log('[AuthStore] Push device token registration skipped/failed:', pushErr);
    }
  });

  // 1. Read local member profile from SQLite for 0ms offline application startup
  const localMember = await MemberRepository.getMember(userId);

  if (localMember) {
    const activeMember: UserMember = {
      id: localMember.id,
      groupId: localMember.groupId,
      displayName: localMember.displayName,
      profileImageId: localMember.profileImageId,
      profileImageLocalPath: localMember.profileImageLocalPath,
      joinedAt: new Date().toISOString(),
    };

    set({
      authStatus: 'signed_in',
      membershipStatus: 'member',
      userId,
      userEmail,
      member: activeMember,
      groupName: 'Private Group',
      isLoading: false,
    });
  } else {
    // Local SQLite member does not exist yet (e.g. initial login on new device/fresh install).
    // Keep auth loading state active while performing remote membership verification to avoid flashing JoinGroupScreen.
    set({
      authStatus: 'signed_in',
      userId,
      userEmail,
      isLoading: true,
    });
  }

  // 2. Remote membership reconciliation & centralized startup sync
  try {
    const remoteMember = await api.getCurrentMember(userId);
    if (remoteMember) {
      await MemberRepository.upsertMember(remoteMember);

      let groupName: string | null = null;
      if (remoteMember.groupId) {
        groupName = await api.getGroupName(remoteMember.groupId);
        if (groupName) {
          await MemberRepository.upsertGroup({
            id: remoteMember.groupId,
            name: groupName,
            ownerId: '',
          });
        }
      }

      set({
        membershipStatus: 'member',
        member: remoteMember,
        groupName: groupName || 'Private Group',
        isLoading: false,
      });

      // Centralized startup sync
      await syncEngine.syncAll();
    } else {
      // Remote lookup confirmed user has no group membership
      set({
        membershipStatus: 'no_group',
        member: null,
        groupName: null,
        isLoading: false,
      });
    }
  } catch (netErr: any) {
    console.log('[AuthStore] Remote membership lookup skipped/failed:', netErr);
    if (localMember) {
      set({
        membershipStatus: 'member',
        isLoading: false,
      });
    } else {
      // Network error without local member: stop loading without routing to JoinGroupScreen
      set({
        isLoading: false,
        error: 'Network connection unavailable. Please check your connection and try again.',
      });
    }
  }
};

let authStateSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'signed_out',
  membershipStatus: 'no_group',
  userEmail: null,
  userId: null,
  member: null,
  groupName: null,
  isLoading: true,
  error: null,

  initializeAuth: async () => {
    set({ isLoading: true, error: null });

    const handleAuthUrl = async (url: string | null) => {
      if (__DEV__) {
        console.log('[AuthStore] Received auth callback URL:', url);
      }
      const params = parseAndValidateAuthUrl(url);
      if (!params) return;

      try {
        if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        } else if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
      } catch (e: any) {
        console.error('[AuthStore] Auth callback processing failed:', e);
        set({ error: e.message || 'Failed to process auth callback' });
      }
    };

    if (!isDeepLinkListenerRegistered) {
      isDeepLinkListenerRegistered = true;
      Linking.addEventListener('url', (event) => {
        handleAuthUrl(event.url);
      });
    }

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      await handleAuthUrl(initialUrl);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await handleSessionUpdate(set, get, session);
    } catch (e: any) {
      // getSession() threw — likely a SQLite init race on cold start or an op-sqlite error.
      // Before forcing a logout, attempt to recover the userId from any existing store state
      // and check local SQLite for a member record. Only sign out if truly unrecoverable.
      console.warn('[AuthStore] getSession() threw unexpectedly:', e.message);
      const existingUserId = get().userId;
      if (existingUserId) {
        const localMember = await MemberRepository.getMember(existingUserId).catch(() => null);
        if (localMember) {
          console.log('[AuthStore] Recovered session from local SQLite after getSession() error.');
          set({ isLoading: false, error: null });
          return;
        }
      }
      // Truly unrecoverable — sign out cleanly
      set({
        authStatus: 'signed_out',
        membershipStatus: 'no_group',
        isLoading: false,
        error: e.message || 'Failed to check auth state',
      });
    }

    // Subscribe to Supabase auth state changes (registered exactly once across app lifecycle)
    if (!authStateSubscription) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        await handleSessionUpdate(set, get, session, event);
      });
      authStateSubscription = data?.subscription || null;
    }
  },

  createGroup: async (groupName: string, displayName: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    const res = await api.createGroup(groupName, displayName);
    if (res.success && res.member) {
      await MemberRepository.upsertMember(res.member);
      if (res.groupId) {
        await MemberRepository.upsertGroup({
          id: res.groupId,
          name: groupName.trim(),
          ownerId: res.member.id,
        });
      }
      set({
        membershipStatus: 'member',
        member: res.member,
        groupName: groupName.trim(),
        isLoading: false,
      });
      syncEngine.syncAll();
      return true;
    } else {
      set({
        isLoading: false,
        error: res.error || 'Failed to create group',
      });
      return false;
    }
  },

  joinGroup: async (code: string, displayName: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    const res = await api.joinGroupWithInvitation(code, displayName);
    if (res.success && res.member) {
      await MemberRepository.upsertMember(res.member);
      const groupName = await api.getGroupName(res.member.groupId);
      if (groupName) {
        await MemberRepository.upsertGroup({
          id: res.member.groupId,
          name: groupName,
          ownerId: '',
        });
      }
      set({
        membershipStatus: 'member',
        member: res.member,
        groupName,
        isLoading: false,
      });
      syncEngine.syncAll();
      return true;
    } else {
      set({
        isLoading: false,
        error: res.error || 'Invalid invitation code',
      });
      return false;
    }
  },

  signOut: async () => {
    isExplicitSigningOut = true;
    set({ isLoading: true });
    try {
      await pushService.deactivateCurrentDeviceToken();
    } catch (e) {
      if (__DEV__) {
        console.log('[AuthStore] Deactivating push token failed gracefully:', e);
      }
    }
    try {
      await api.signOut();
    } catch (e) {
      if (__DEV__) {
        console.log('[AuthStore] Remote sign out failed (offline), clearing local session anyway:', e);
      }
    } finally {
      set({
        authStatus: 'signed_out',
        membershipStatus: 'no_group',
        userId: null,
        userEmail: null,
        member: null,
        groupName: null,
        isLoading: false,
      });
      isExplicitSigningOut = false;
    }
  },

  setError: (err) => set({ error: err }),
}));
