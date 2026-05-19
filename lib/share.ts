import { strToU8, compressSync, decompressSync, strFromU8 } from 'fflate';
import { FJFile } from './types';

const MAX_ENCODED = 250_000;
const MAX_DECODED = 4 * 1024 * 1024; // 4 MB cap on decompressed JSON

function bytesToBase64(bytes: Uint8Array): string {
  // `btoa(String.fromCharCode(...bytes))` throws RangeError on large arrays
  // because the spread becomes an arg-list that overflows the call stack.
  // Build the binary string in chunks instead.
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(files: FJFile[]): string {
  const payload = files.map((f) => ({ name: f.name, content: f.content }));
  const json = JSON.stringify(payload);
  const compressed = compressSync(strToU8(json));
  return bytesToBase64(compressed)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function decodeShare(
  param: string,
): Array<{ name: string; content: string }> | null {
  // Reject obviously too-large URL params before attempting any work —
  // decompression of a small input can balloon to GBs (zip-bomb).
  if (param.length === 0 || param.length > MAX_ENCODED) return null;
  try {
    const padded = param.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = base64ToBytes(padded);
    const decompressed = decompressSync(bytes);
    // Hard cap on decompressed output to defeat zip bombs. fflate's sync
    // API doesn't expose a streaming size limit, so we cap input above and
    // re-check output here. With MAX_ENCODED ~250KB, a malicious 1000:1
    // ratio still bounds memory under ~250 MB before this check fires.
    if (decompressed.byteLength > MAX_DECODED) return null;
    const json = strFromU8(decompressed);
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const result = (parsed as unknown[]).filter(
      (f): f is { name: string; content: string } =>
        typeof (f as Record<string, unknown>).name === 'string' &&
        typeof (f as Record<string, unknown>).content === 'string',
    );
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}
