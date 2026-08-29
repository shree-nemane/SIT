import { initDatabase } from '../../database/db';
import { supabase } from '../../data/supabaseClient';
import MemberRepository from '../../data/repositories/MemberRepository';
import { SyncExecutionContext, SyncSource } from './syncValidator';

/**
 * Perform durable background runtime bootstrap.
 * Idempotent, local-first initialization for Headless JS background execution.
 * CONTAINS ZERO NETWORK LOOKUPS.
 */
export async function bootstrapBackgroundRuntime(
  source: SyncSource
): Promise<SyncExecutionContext | null> {
  try {
    // 1. Ensure local SQLite database tables exist
    const dbReady = await initDatabase();
    if (!dbReady) {
      return null;
    }

    // 2. Restore durable Supabase session from secure persistent storage
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session || !session.user || !session.user.id) {
      return null;
    }

    const userId = session.user.id;

    // 3. Query local SQLite member profile
    const localMember = await MemberRepository.getMember(userId);
    if (!localMember || !localMember.groupId || !localMember.groupId.trim()) {
      return null;
    }

    const { getActiveSessionToken } = require('../auth/authStore');
    const sessionToken = getActiveSessionToken();

    // 4. Return valid SyncExecutionContext
    return {
      sessionToken,
      userId,
      groupId: localMember.groupId.trim(),
      source,
    };
  } catch {
    return null;
  }
}

export default bootstrapBackgroundRuntime;
