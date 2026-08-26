/**
 * Environment Configuration for Stay in Touch
 * Loads client-side configuration (SUPABASE_URL and SUPABASE_ANON_KEY) safely.
 */

declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

declare const __DEV__: boolean | undefined;

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

const DEFAULT_SUPABASE_URL = 'https://id.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'key';

const rawUrl = process?.env?.SUPABASE_URL || '';
const rawKey = process?.env?.SUPABASE_ANON_KEY || '';

const isUrlConfigured = rawUrl.startsWith('http');
const isKeyConfigured = rawKey.length > 10;

export const getStorageKey = (supabaseUrl: string): string => {
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('[Env Configuration Error] SUPABASE_URL is missing or invalid.');
  }
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split('.')[0];
    if (!projectRef) {
      throw new Error('[Env Configuration Error] Could not extract project ref from SUPABASE_URL.');
    }
    return `sb-${projectRef}-auth-token`;
  } catch (err: any) {
    throw new Error(`[Env Configuration Error] Failed to derive storage key: ${err?.message}`);
  }
};

export const ENV = {
  SUPABASE_URL: isUrlConfigured ? rawUrl : DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY: isKeyConfigured ? rawKey : DEFAULT_SUPABASE_ANON_KEY,
  OAUTH_REDIRECT_SCHEME: 'sit://auth/callback',
  isConfigured: isUrlConfigured && isKeyConfigured,
  IS_DEV: isDev,
};

export default ENV;
