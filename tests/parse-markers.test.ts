import { describe, it, expect } from 'vitest';
import { parseMarkers } from '@/lib/parse-markers';

describe('parseMarkers', () => {
  it('parses Unix-style paths', () => {
    const stderr = '/tmp/work/main.fj:5:10: Error: bad token\n';
    expect(parseMarkers(stderr)).toEqual([
      { filename: 'main.fj', startLine: 5, startCol: 10, message: 'bad token' },
    ]);
  });

  it('parses Windows-style paths (basename only)', () => {
    const stderr = 'C:\\Users\\Bob\\src\\main.fj:5:10: Error: bad token\n';
    const markers = parseMarkers(stderr);
    expect(markers).toHaveLength(1);
    expect(markers[0].filename).toBe('main.fj');
    expect(markers[0].startLine).toBe(5);
    expect(markers[0].startCol).toBe(10);
  });

  it('handles missing column', () => {
    const stderr = 'main.fj:5: Warning: unused\n';
    expect(parseMarkers(stderr)).toEqual([
      { filename: 'main.fj', startLine: 5, startCol: 1, message: 'unused' },
    ]);
  });

  it('extracts multiple markers from a single stderr blob', () => {
    const stderr = [
      'main.fj:1:1: Error: a',
      'lib.fj:2:3: Warning: b',
      'main.fj:10: Error: c',
    ].join('\n');
    expect(parseMarkers(stderr)).toHaveLength(3);
  });

  it('returns empty array on non-matching stderr', () => {
    expect(parseMarkers('')).toEqual([]);
    expect(parseMarkers('random output\nno errors here\n')).toEqual([]);
  });

  it('is safe across multiple calls (regex /g state)', () => {
    const stderr = 'main.fj:5:10: Error: x\n';
    expect(parseMarkers(stderr)).toHaveLength(1);
    expect(parseMarkers(stderr)).toHaveLength(1);
    expect(parseMarkers(stderr)).toHaveLength(1);
  });
});
