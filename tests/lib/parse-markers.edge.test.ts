import { describe, it, expect } from 'vitest';
import { parseMarkers } from '@/lib/parse-markers';

describe('parseMarkers — edge cases', () => {
  it('extracts basename from a non-.fj file extension', () => {
    const markers = parseMarkers('lib/util.b:3:1: Error: unknown op');
    expect(markers).toHaveLength(1);
    expect(markers[0].filename).toBe('util.b');
  });

  it('handles Windows paths with spaces in directory names', () => {
    const markers = parseMarkers('C:\\Users\\Tom H\\src\\main.fj:5:10: Error: bad token');
    expect(markers).toHaveLength(1);
    expect(markers[0].filename).toBe('main.fj');
    expect(markers[0].startLine).toBe(5);
    expect(markers[0].startCol).toBe(10);
    expect(markers[0].message).toBe('bad token');
  });

  it('handles a very long non-matching line without hanging (regex safety)', () => {
    const longLine = 'x'.repeat(12_000);
    const start = Date.now();
    const markers = parseMarkers(longLine);
    const elapsed = Date.now() - start;
    expect(markers).toHaveLength(0);
    expect(elapsed).toBeLessThan(1_000);
  });

  it('captures a message that is only whitespace', () => {
    // "\s*(.+)$" — \s* matches 0 chars, (.+) matches the trailing space.
    const markers = parseMarkers('file.fj:1:1: Error:  ');
    expect(markers).toHaveLength(1);
    expect(markers[0].message.trim()).toBe('');
  });

  it('defaults startCol to 1 when column is absent', () => {
    const markers = parseMarkers('main.fj:7: Warning: unused label');
    expect(markers).toHaveLength(1);
    expect(markers[0].startLine).toBe(7);
    expect(markers[0].startCol).toBe(1);
    expect(markers[0].message).toBe('unused label');
  });

  it('does not corrupt state across repeated calls (stateful /g regex)', () => {
    // parseMarkers resets RE.lastIndex = 0 on each call; if it forgot,
    // the second call would start mid-string and miss matches.
    const stderr = 'main.fj:1:1: Error: first\nmain.fj:2:1: Error: second';
    const first = parseMarkers(stderr);
    const second = parseMarkers(stderr);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second[0].message).toBe('first');
    expect(second[1].message).toBe('second');
  });

  it('extracts basename correctly from Unix absolute paths', () => {
    const markers = parseMarkers('/home/user/project/src/main.fj:10:5: Error: syntax error');
    expect(markers).toHaveLength(1);
    expect(markers[0].filename).toBe('main.fj');
    expect(markers[0].startLine).toBe(10);
    expect(markers[0].startCol).toBe(5);
  });

  it('handles case-insensitive error/warning keywords', () => {
    const stderr = [
      'a.fj:1:1: Error: upper E',
      'b.fj:2:2: error: lower e',
      'c.fj:3:3: Warning: upper W',
      'd.fj:4:4: warning: lower w',
    ].join('\n');
    const markers = parseMarkers(stderr);
    expect(markers).toHaveLength(4);
    expect(markers.map(m => m.filename)).toEqual(['a.fj', 'b.fj', 'c.fj', 'd.fj']);
  });
});
