import { strToU8, compressSync, decompressSync, strFromU8 } from 'fflate';
import { FJFile } from './types';

export function encodeShare(files: FJFile[]): string {
  const payload = files.map(f => ({ name: f.name, content: f.content }));
  const json = JSON.stringify(payload);
  const compressed = compressSync(strToU8(json));
  return btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function decodeShare(param: string): Array<{ name: string; content: string }> | null {
  try {
    const padded = param.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = strFromU8(decompressSync(bytes));
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const result = (parsed as unknown[]).filter(
      (f): f is { name: string; content: string } =>
        typeof (f as Record<string, unknown>).name === 'string' &&
        typeof (f as Record<string, unknown>).content === 'string'
    );
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}
