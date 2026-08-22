import { create } from 'zustand';
import { Linking } from 'react-native';
import { AuthStatus, MembershipStatus, UserMember } from './types';
import { supabase } from '../../data/supabaseClient';
import { api } from '../../data/api';
import MemberRepository from '../../data/repositories/MemberRepository';
import syncEngine from '../sync/syncEngine';
import pushService from '../notifications/pushService';

const parseDeepLinkParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  if (!url) return params;

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  let paramString = '';
  if (hashIndex !== -1) {
    paramString = url.substring(hashIndex + 1);
  } else if (queryIndex !== -1) {
    paramString = url.substring(queryIndex + 1);
  }

  if (paramString) {
    const pairs = paramString.split('&');
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        if (pair) params[decodeURIComponent(pair)] = '';
        continue;
      }
      const key = pair.slice(0, eqIndex);
      const value = pair.slice(eqIndex + 1);
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }
  }
  return params;
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

const handleSessionUpdate = async (
  set: (state: Partial<AuthStore>) => void,
  session: any
) => {
  if (!session || !session.user) {
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

export const useAuthStore = create<AuthStore>((set) => ({
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
      if (!url || !url.includes('sit://')) return;
      try {
        const params = parseDeepLinkParams(url);
        if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        } else if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
      } catch (e: any) {
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
      await handleSessionUpdate(set, session);
    } catch (e: any) {
      set({
        authStatus: 'signed_out',
        membershipStatus: 'no_group',
        isLoading: false,
        error: e.message || 'Failed to check auth state',
      });
    }

    // Subscribe to Supabase auth state changes (registered exactly once across app lifecycle)
    if (!authStateSubscription) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        await handleSessionUpdate(set, session);
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
    set({ isLoading: true });
    try {
      await pushService.deactivateCurrentDeviceToken();
    } catch (e) {
      if (__DEV__) {
        console.log('[AuthStore] Deactivating push token failed gracefully:', e);
      }
    }
    await api.signOut();
    set({
      authStatus: 'signed_out',
      membershipStatus: 'no_group',
      userId: null,
      userEmail: null,
      member: null,
      isLoading: false,
    });
  },

  setError: (err) => set({ error: err }),
}));
