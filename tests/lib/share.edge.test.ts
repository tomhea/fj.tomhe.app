import { describe, it, expect } from 'vitest';
import { strToU8, compressSync } from 'fflate';
import { encodeShare, decodeShare } from '@/lib/share';
import type { FJFile } from '@/lib/types';

const MAX_ENCODED = 250_000;

function makeEncoded(value: unknown): string {
  const json = JSON.stringify(value);
  const compressed = compressSync(strToU8(json));
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < compressed.length; i += CHUNK) {
    bin += String.fromCharCode(...compressed.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const fj = (name: string, content: string): FJFile => ({ id: '_', name, content });

describe('decodeShare — adversarial payloads', () => {
  it('returns null when JSON is an object, not an array', () => {
    expect(decodeShare(makeEncoded({ foo: 'bar' }))).toBeNull();
  });

  it('returns null when JSON is null', () => {
    expect(decodeShare(makeEncoded(null))).toBeNull();
  });

  it('returns null when JSON is a number', () => {
    expect(decodeShare(makeEncoded(42))).toBeNull();
  });

  it('filters out entries missing the name field', () => {
    const result = decodeShare(makeEncoded([
      { name: 'good.fj', content: 'ok' },
      { content: 'no name here' },
    ]));
    expect(result).toEqual([{ name: 'good.fj', content: 'ok' }]);
  });

  it('filters out entries missing the content field', () => {
    const result = decodeShare(makeEncoded([
      { name: 'good.fj', content: 'ok' },
      { name: 'no-content.fj' },
    ]));
    expect(result).toEqual([{ name: 'good.fj', content: 'ok' }]);
  });

  it('filters out entries where name is not a string', () => {
    const result = decodeShare(makeEncoded([
      { name: 'good.fj', content: 'ok' },
      { name: 123, content: 'numeric name' },
    ]));
    expect(result).toEqual([{ name: 'good.fj', content: 'ok' }]);
  });

  it('filters out entries where content is not a string', () => {
    const result = decodeShare(makeEncoded([
      { name: 'good.fj', content: 'ok' },
      { name: 'bad.fj', content: true },
    ]));
    expect(result).toEqual([{ name: 'good.fj', content: 'ok' }]);
  });

  it('returns null when all entries are filtered out', () => {
    expect(decodeShare(makeEncoded([
      { content: 'no name' },
      { name: 42, content: 'bad type' },
    ]))).toBeNull();
  });

  it('rejects input of exactly MAX_ENCODED + 1 chars', () => {
    expect(decodeShare('A'.repeat(MAX_ENCODED + 1))).toBeNull();
  });

  it('input of MAX_ENCODED chars passes the length check but fails decompression', () => {
    // Random ASCII at this length won't decompress; we just verify it returns null (not throws).
    expect(decodeShare('A'.repeat(MAX_ENCODED))).toBeNull();
  });

  it('round-trips a file with NUL bytes in content', () => {
    const encoded = encodeShare([fj('test.fj', 'hello\x00world')]);
    const decoded = decodeShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded![0].content).toBe('hello\x00world');
  });

  it('round-trips filenames containing URL-special characters', () => {
    const encoded = encodeShare([fj('file+name=test.fj', 'x')]);
    // URL-safe base64: no +, /, or =
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    const decoded = decodeShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded![0].name).toBe('file+name=test.fj');
  });

  it('encodeShare output is always URL-safe', () => {
    const encoded = encodeShare([fj('main.fj', 'x !@#$%^&*() special chars')]);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
