import { getStorageKey } from '../src/config/env';

describe('Environment Storage Key Helper', () => {
  it('should derive storage key from valid Supabase HTTPS URL', () => {
    const url = 'https://jcuofnsjxqmndezfsvyg.supabase.co';
    const key = getStorageKey(url);
    expect(key).toBe('sb-jcuofnsjxqmndezfsvyg-auth-token');
  });

  it('should throw an explicit error if SUPABASE_URL is missing or invalid', () => {
    expect(() => getStorageKey('')).toThrow('[Env Configuration Error]');
    expect(() => getStorageKey('invalid-url')).toThrow('[Env Configuration Error]');
  });
});
