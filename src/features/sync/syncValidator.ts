import { supabase } from '../../data/supabaseClient';
import MemberRepository from '../../data/repositories/MemberRepository';

export type SyncSource =
  | 'foreground_push'
  | 'background_fcm'
  | 'periodic'
  | 'startup'
  | 'network_restore'
  | 'manual';

export interface SyncExecutionContext {
  sessionToken: number;
  userId: string;
  groupId: string;
  source: SyncSource;
}

export type SyncCheckpoint =
  | 'pre_fetch'
  | 'pre_commit'
  | 'post_commit';

export const SyncExecutionContextValidator = {
  /**
   * Validate synchronization execution context at critical checkpoints.
   * Supports both active UI runtime and Headless background runtime validation.
   */
  async validateContext(
    context: SyncExecutionContext,
    checkpoint: SyncCheckpoint
  ): Promise<boolean> {
    if (!context || !context.userId || !context.groupId) {
      return false;
    }

    try {
      const { useAuthStore, getActiveSessionToken } = require('../auth/authStore');
      const authState = useAuthStore.getState();
      const isUIRunning = authState.authStatus === 'signed_in';

      // 1. Active UI Foreground Runtime Validation
      if (isUIRunning) {
        const currentToken = getActiveSessionToken();
        return (
          currentToken === context.sessionToken &&
          authState.userId === context.userId &&
          authState.member?.groupId === context.groupId &&
          authState.membershipStatus === 'member'
        );
      }

      // 2. Headless Background Runtime Validation (Durable Supabase Session + Durable SQLite Member)
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session || !session.user || session.user.id !== context.userId) {
        return false;
      }

      const localMember = await MemberRepository.getMember(context.userId);
      if (!localMember || !localMember.groupId || localMember.groupId !== context.groupId) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },
};

export default SyncExecutionContextValidator;
