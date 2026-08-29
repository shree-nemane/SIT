import { supabase } from './supabaseClient';
import { UserMember } from '../features/auth/types';

export type MemberLookupResult =
  | { status: 'found'; member: UserMember }
  | { status: 'not_found' }
  | { status: 'error'; error: string };

export const api = {
  /**
   * Initiate Google OAuth Sign-In with Supabase
   */
  async signInWithGoogle(): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'sit://auth/callback',
        },
      });
      if (error) return { error: error.message };
      return { url: data.url };
    } catch (e: any) {
      return { error: e.message || 'Failed to initiate Google sign-in' };
    }
  },

  /**
   * Fetch member details for authenticated user
   */
  async getCurrentMember(userId: string): Promise<MemberLookupResult> {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return { status: 'error', error: error.message };
      }

      if (!data) {
        return { status: 'not_found' };
      }

      return {
        status: 'found',
        member: {
          id: data.id,
          groupId: data.group_id,
          displayName: data.display_name,
          profileImageId: data.profile_image_id,
          joinedAt: data.joined_at,
        },
      };
    } catch (e: any) {
      return { status: 'error', error: e?.message || 'Failed to query member profile' };
    }
  },

  /**
   * Fetch group details (group name)
   */
  async getGroupName(groupId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();

      return data ? data.name : null;
    } catch {
      return null;
    }
  },

  /**
   * Validate invitation code and join group atomically via backend RPC (Requirement #6)
   */
  async joinGroupWithInvitation(
    code: string,
    displayName: string
  ): Promise<{ success: boolean; member?: UserMember; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('join_group_with_code', {
        p_code: code.trim(),
        p_display_name: displayName.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success && data.member) {
        const m = data.member;
        return {
          success: true,
          member: {
            id: m.id,
            groupId: m.group_id,
            displayName: m.display_name,
            profileImageId: m.profile_image_id,
            joinedAt: m.joined_at,
          },
        };
      }

      return { success: false, error: data?.message || 'Failed to join group' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error joining group' };
    }
  },

  /**
   * Create a new group and register caller as owner (Requirement #13)
   */
  async createGroup(
    groupName: string,
    displayName: string
  ): Promise<{ success: boolean; member?: UserMember; groupId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_group', {
        p_group_name: groupName.trim(),
        p_display_name: displayName.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success && data.member) {
        const m = data.member;
        return {
          success: true,
          groupId: data.group_id,
          member: {
            id: m.id,
            groupId: m.group_id,
            displayName: m.display_name,
            profileImageId: m.profile_image_id,
            joinedAt: m.joined_at,
          },
        };
      }

      return { success: false, error: data?.message || 'Failed to create group' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating group' };
    }
  },

  /**
   * Fetch current active non-expired invitation code for owner's group (OWNER ONLY)
   */
  async getActiveInvitation(): Promise<{ success: boolean; code?: string; expiresAt?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_active_invitation');

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success && data.code) {
        return {
          success: true,
          code: data.code,
          expiresAt: data.expires_at,
        };
      }

      return { success: false, error: data?.message || 'No active invitation code' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error fetching active invitation' };
    }
  },

  /**
   * Generate an invitation code for group (OWNER ONLY)
   */
  async generateInvitation(
    code: string,
    expiresInDays?: number,
    maxUses?: number
  ): Promise<{ success: boolean; code?: string; expiresAt?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('generate_invitation', {
        p_code: code.trim(),
        p_expires_in_days: expiresInDays && expiresInDays > 0 ? expiresInDays : 1,
        p_max_uses: maxUses || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        return { success: true, code: data.code, expiresAt: data.expires_at };
      }

      return { success: false, error: data?.message || 'Failed to generate invitation' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error generating invitation' };
    }
  },

  /**
   * Register or update FCM push device token for current user
   */
  async registerPushDevice(
    token: string,
    platform: string = 'android'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('register_push_device', {
        p_token: token,
        p_platform: platform,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        return { success: true };
      }

      return { success: false, error: data?.error || 'Failed to register push device' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error registering push device' };
    }
  },

  /**
   * Deactivate FCM push device token for current user
   */
  async deactivatePushDevice(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('deactivate_push_device', {
        p_token: token,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error deactivating push device' };
    }
  },

  /**
   * Sign out current session
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};

export default api;
