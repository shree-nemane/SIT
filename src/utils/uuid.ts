/**
 * RFC-4122 Compliant V4 UUID Generator & Validator
 */
export const isUUID = (str: unknown): boolean => {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(str);
};

/* eslint-disable no-bitwise */
export const generateUUID = (): string => {
  const gCrypto = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  if (gCrypto && typeof gCrypto.randomUUID === 'function') {
    return gCrypto.randomUUID();
  }
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    gCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC-4122 v4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant 1
    const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default generateUUID;

