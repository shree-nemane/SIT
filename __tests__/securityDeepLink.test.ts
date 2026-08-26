import { parseAndValidateAuthUrl } from '../src/features/auth/authStore';

describe('OAuth Deep Link Parser & Validation Security (sit://auth/callback)', () => {
  // 1. Valid Callbacks
  it('should accept valid PKCE authorization code callback: sit://auth/callback?code=mock_code_123', () => {
    const url = 'sit://auth/callback?code=mock_code_123';
    const params = parseAndValidateAuthUrl(url);
    expect(params).toEqual({ code: 'mock_code_123' });
  });

  it('should accept valid trailing-slash callback: sit://auth/callback/?code=mock_code_123', () => {
    const url = 'sit://auth/callback/?code=mock_code_123';
    const params = parseAndValidateAuthUrl(url);
    expect(params).toEqual({ code: 'mock_code_123' });
  });

  // 2. Fragment Tokens & PKCE Parameters Parsing
  it('should accept implicit hash fragment token callback: sit://auth/callback#access_token=acc123&refresh_token=ref123', () => {
    const url = 'sit://auth/callback#access_token=acc123&refresh_token=ref123';
    const params = parseAndValidateAuthUrl(url);
    expect(params).toEqual({
      access_token: 'acc123',
      refresh_token: 'ref123',
    });
  });

  it('should accept callback with query code parameter and parse hash fragment tokens safely', () => {
    const url = 'sit://auth/callback?code=code_abc#access_token=acc123&refresh_token=ref123';
    const params = parseAndValidateAuthUrl(url);
    expect(params).toEqual({
      code: 'code_abc',
      access_token: 'acc123',
      refresh_token: 'ref123',
    });
  });

  // 3. Malicious Schemes
  it('should reject unauthorized protocol scheme: https://auth/callback?code=123', () => {
    const url = 'https://auth/callback?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  it('should reject phishing protocol scheme: phishing://auth/callback?code=123', () => {
    const url = 'phishing://auth/callback?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  // 4. Malicious Hostnames
  it('should reject unauthorized hostname: sit://attacker/callback?code=123', () => {
    const url = 'sit://attacker/callback?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  it('should reject missing hostname: sit:///callback?code=123', () => {
    const url = 'sit:///callback?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  // 5. Malicious Paths
  it('should reject invalid path: sit://auth/wrongpath?code=123', () => {
    const url = 'sit://auth/wrongpath?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  it('should reject nested path: sit://auth/callback/nested?code=123', () => {
    const url = 'sit://auth/callback/nested?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  it('should reject root path: sit://auth?code=123', () => {
    const url = 'sit://auth?code=123';
    expect(parseAndValidateAuthUrl(url)).toBeNull();
  });

  // 6. Malformed URLs and Edge Cases
  it('should return null for null, undefined, or empty strings', () => {
    expect(parseAndValidateAuthUrl(null)).toBeNull();
    expect(parseAndValidateAuthUrl(undefined)).toBeNull();
    expect(parseAndValidateAuthUrl('')).toBeNull();
  });

  it('should return null for non-URL junk strings', () => {
    expect(parseAndValidateAuthUrl('not_a_valid_url')).toBeNull();
    expect(parseAndValidateAuthUrl('sit://')).toBeNull();
  });

  // 7. Prototype Pollution Safety
  it('should filter out dangerous prototype properties in parameters', () => {
    const url = 'sit://auth/callback?__proto__[polluted]=true&code=safe_code';
    const params = parseAndValidateAuthUrl(url);
    expect(params).toEqual({ code: 'safe_code' });
    expect((params as any).__proto__?.polluted).toBeUndefined();
  });
});
