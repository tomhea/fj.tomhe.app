import { describe, it, expect } from 'vitest';
import { encodeShare, decodeShare } from '@/lib/share';

const file = (name: string, content: string) => ({ id: '_', name, content });

describe('share encoder/decoder', () => {
  it('round-trips a single file', () => {
    const encoded = encodeShare([file('main.fj', 'halt\n')]);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeShare(encoded);
    expect(decoded).toEqual([{ name: 'main.fj', content: 'halt\n' }]);
  });

  it('round-trips multiple files with newlines and unicode', () => {
    const files = [
      file('main.fj', '.startup main\nmain: halt\n'),
      file('lib.fj', '; ☃ snowman comment\n'),
    ];
    const decoded = decodeShare(encodeShare(files));
    expect(decoded).toEqual(files.map(({ id: _id, ...rest }) => rest));
  });

  it('handles a large payload (>100KB compressed) without throwing', () => {
    // ~250KB of FJ content — would blow the call stack on
    // `btoa(String.fromCharCode(...uint8))` without chunking.
    const big = 'main: halt\noutput \'X\'\n'.repeat(12_500);
    const encoded = encodeShare([file('big.fj', big)]);
    const decoded = decodeShare(encoded);
    expect(decoded?.[0].name).toBe('big.fj');
    expect(decoded?.[0].content).toBe(big);
  });

  it('returns null for malformed input', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('not-base64!@#')).toBeNull();
    expect(decodeShare('AAAA')).toBeNull(); // valid base64, invalid deflate
  });

  it('rejects oversized URL params (input cap)', () => {
    const huge = 'A'.repeat(300_000);
    expect(decodeShare(huge)).toBeNull();
  });
});
