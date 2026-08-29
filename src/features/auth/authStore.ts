import { create } from 'zustand';
import { Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthStatus, MembershipStatus, SessionVerificationStatus, UserMember } from './types';
import { supabase } from '../../data/supabaseClient';
import { api } from '../../data/api';
import MemberRepository from '../../data/repositories/MemberRepository';
import syncEngine from '../sync/syncEngine';
import pushService from '../notifications/pushService';
import widgetSnapshotService from '../widget/widgetSnapshot';

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
  sessionVerificationStatus: SessionVerificationStatus;
  userEmail: string | null;
  userId: string | null;
  member: UserMember | null;
  groupName: string | null;
  isLoading: boolean;
  isAuthInitialized: boolean;
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
let activeSessionToken = 0;

export const getActiveSessionToken = () => activeSessionToken;

export const bumpSessionToken = () => {
  activeSessionToken++;
  return activeSessionToken;
};

const schedulePostBootstrapWork = (
  userId: string,
  tokenAtStart: number,
  set: (state: Partial<AuthStore>) => void,
  get: () => AuthStore
) => {
  setTimeout(() => {
    // Sibling Task 1: Remote Authority Verification
    (async () => {
      if (
        activeSessionToken !== tokenAtStart ||
        get().userId !== userId ||
        get().authStatus !== 'signed_in'
      ) {
        return;
      }

      set({ sessionVerificationStatus: 'verifying' });
      try {
        const lookup = await api.getCurrentMember(userId);

        if (
          activeSessionToken !== tokenAtStart ||
          get().userId !== userId ||
          get().authStatus !== 'signed_in'
        ) {
          return;
        }

        if (lookup.status === 'found') {
          const remoteMember = lookup.member;
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

          if (
            activeSessionToken !== tokenAtStart ||
            get().userId !== userId ||
            get().authStatus !== 'signed_in'
          ) {
            return;
          }

          set({
            membershipStatus: 'member',
            member: remoteMember,
            groupName: groupName || 'Private Group',
            sessionVerificationStatus: 'verified',
          });
        } else if (lookup.status === 'not_found') {
          // CONFIRMED REVOCATION: Remote Supabase lookup confirmed member record was explicitly deleted
          await MemberRepository.deleteMember(userId);

          if (
            activeSessionToken !== tokenAtStart ||
            get().userId !== userId ||
            get().authStatus !== 'signed_in'
          ) {
            return;
          }

          set({
            membershipStatus: 'no_group',
            member: null,
            groupName: null,
            sessionVerificationStatus: 'unknown',
          });
        } else {
          // NETWORK / SERVER FAILURE (lookup.status === 'error'):
          // KEEP LOCAL SESSION! Do NOT treat as membership revocation!
          set({ sessionVerificationStatus: 'offline' });
        }
      } catch (netErr: any) {
        if (
          activeSessionToken === tokenAtStart &&
          get().userId === userId &&
          get().authStatus === 'signed_in'
        ) {
          set({ sessionVerificationStatus: 'offline' });
        }
      }
    })();

    // Sibling Task 2: Background Synchronization
    (async () => {
      if (
        activeSessionToken !== tokenAtStart ||
        get().userId !== userId ||
        get().authStatus !== 'signed_in'
      ) {
        return;
      }
      const currentState = get();
      if (currentState.membershipStatus !== 'member') {
        return;
      }
      syncEngine.syncAll();
    })();
  }, 0);
};

const handleSessionUpdate = async (
  set: (state: Partial<AuthStore>) => void,
  get: () => AuthStore,
  session: any,
  event?: string
) => {
  const previousUserId = get().userId;
  const isUserChange = !session?.user || session.user.id !== previousUserId;
  const currentToken = isUserChange ? bumpSessionToken() : activeSessionToken;

  if (!session || !session.user) {
    if (!isExplicitSigningOut && (event === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT')) {
      const netState = await NetInfo.fetch();
      const isOffline = !netState.isConnected || !netState.isInternetReachable;
      const currentUserId = get().userId;

      if (isOffline && currentUserId) {
        set({ sessionVerificationStatus: 'offline' });
        return;
      }
    }

    set({
      authStatus: 'signed_out',
      membershipStatus: 'no_group',
      sessionVerificationStatus: 'unknown',
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

  pushService.registerCurrentDeviceToken(userId).catch((pushErr) => {
    if (__DEV__) {
      // console.log('[AuthStore] Push device token registration skipped/failed:', pushErr);
    }
  });

  // 1. Read local member profile from SQLite for fast local-first application startup
  const localMember = await MemberRepository.getMember(userId);

  if (activeSessionToken !== currentToken) return;

  if (localMember) {
    const activeMember: UserMember = {
      id: localMember.id,
      groupId: localMember.groupId,
      displayName: localMember.displayName,
      profileImageId: localMember.profileImageId,
      profileImageLocalPath: localMember.profileImageLocalPath,
      joinedAt: new Date().toISOString(),
    };

    const localGroupName = localMember.groupId
      ? await MemberRepository.getGroupName(localMember.groupId)
      : null;

    // Atomic Local Auth State Commit
    set({
      authStatus: 'signed_in',
      membershipStatus: 'member',
      userId,
      userEmail,
      member: activeMember,
      groupName: localGroupName || 'Private Group',
      isLoading: false,
      isAuthInitialized: true,
      sessionVerificationStatus: 'unknown',
    });

    // Schedule encapsulated background session verification and single sync entry point
    schedulePostBootstrapWork(userId, currentToken, set, get);
    return;
  }

  // 2. Fresh login / new device path (no local SQLite member yet): Perform remote lookup
  set({
    authStatus: 'signed_in',
    userId,
    userEmail,
    isLoading: true,
    sessionVerificationStatus: 'verifying',
  });

  try {
    const lookup = await api.getCurrentMember(userId);

    if (activeSessionToken !== currentToken || get().userId !== userId) return;

    if (lookup.status === 'found') {
      const remoteMember = lookup.member;
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

      if (activeSessionToken !== currentToken || get().userId !== userId) return;

      set({
        membershipStatus: 'member',
        member: remoteMember,
        groupName: groupName || 'Private Group',
        isLoading: false,
        sessionVerificationStatus: 'verified',
      });

      syncEngine.syncAll();
    } else if (lookup.status === 'not_found') {
      set({
        membershipStatus: 'no_group',
        member: null,
        groupName: null,
        isLoading: false,
        sessionVerificationStatus: 'unknown',
      });
    } else {
      set({
        isLoading: false,
        sessionVerificationStatus: 'offline',
        error: 'Network connection unavailable. Please check your connection and try again.',
      });
    }
  } catch (netErr: any) {
    if (activeSessionToken === currentToken && get().userId === userId) {
      set({
        isLoading: false,
        sessionVerificationStatus: 'offline',
        error: 'Network connection unavailable. Please check your connection and try again.',
      });
    }
  }
};

let authStateSubscription: { unsubscribe: () => void } | null = null;
let authInitializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'signed_out',
  membershipStatus: 'no_group',
  sessionVerificationStatus: 'unknown',
  userEmail: null,
  userId: null,
  member: null,
  groupName: null,
  isLoading: true,
  isAuthInitialized: false,
  error: null,

  initializeAuth: async () => {
    if (get().isAuthInitialized) return;
    if (authInitializePromise) return authInitializePromise;

    authInitializePromise = (async () => {
      set({ isLoading: true, error: null });

      const handleAuthUrl = async (url: string | null) => {
        if (__DEV__) {
          // console.log('[AuthStore] Received auth callback URL:', url);
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
          // console.error('[AuthStore] Auth callback processing failed:', e);
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
        // getSession() threw — attempt to recover session from local SQLite before signing out
        const existingUserId = get().userId;
        if (existingUserId) {
          const localMember = await MemberRepository.getMember(existingUserId).catch(() => null);
          if (localMember) {
            set({ isLoading: false, error: null, sessionVerificationStatus: 'offline' });
          } else {
            set({
              authStatus: 'signed_out',
              membershipStatus: 'no_group',
              sessionVerificationStatus: 'unknown',
              isLoading: false,
              error: e.message || 'Failed to check auth state',
            });
          }
        } else {
          set({
            authStatus: 'signed_out',
            membershipStatus: 'no_group',
            sessionVerificationStatus: 'unknown',
            isLoading: false,
            error: e.message || 'Failed to check auth state',
          });
        }
      } finally {
        set({ isAuthInitialized: true, isLoading: false });
        authInitializePromise = null;
      }

      // Subscribe to Supabase auth state changes (registered exactly once across app lifecycle)
      if (!authStateSubscription) {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          await handleSessionUpdate(set, get, session, event);
        });
        authStateSubscription = data?.subscription || null;
      }
    })();

    return authInitializePromise;
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
        sessionVerificationStatus: 'verified',
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
        sessionVerificationStatus: 'verified',
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
    bumpSessionToken();
    isExplicitSigningOut = true;
    set({ isLoading: true });
    try {
      await pushService.deactivateCurrentDeviceToken();
    } catch (e) {
      if (__DEV__) {
        // console.log('[AuthStore] Deactivating push token failed gracefully:', e);
      }
    }
    try {
      await widgetSnapshotService.clearWidgetSnapshot();
    } catch (e) {
      if (__DEV__) {
        // console.log('[AuthStore] Clearing widget snapshot failed gracefully:', e);
      }
    }
    try {
      await api.signOut();
    } catch (e) {
      if (__DEV__) {
        // console.log('[AuthStore] Remote sign out failed (offline), clearing local session anyway:', e);
      }
    } finally {
      set({
        authStatus: 'signed_out',
        membershipStatus: 'no_group',
        sessionVerificationStatus: 'unknown',
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
