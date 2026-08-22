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

if (!isUrlConfigured || !isKeyConfigured) {
  console.warn(
    '[ENV Warning] SUPABASE_URL or SUPABASE_ANON_KEY environment variables not provided. Utilizing fallback configuration.'
  );
}

export const ENV = {
  SUPABASE_URL: isUrlConfigured ? rawUrl : DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY: isKeyConfigured ? rawKey : DEFAULT_SUPABASE_ANON_KEY,
  OAUTH_REDIRECT_SCHEME: 'sit://auth/callback',
  isConfigured: isUrlConfigured && isKeyConfigured,
  IS_DEV: isDev,
};

export default ENV;
