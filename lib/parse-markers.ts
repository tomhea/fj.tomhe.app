import { MonacoMarker } from './types';

// Matches typical compiler error lines:
//   path/file.fj:5:10: Error: bad token
//   path/file.fj:5: Warning: unused
//   C:\path\file.fj:5:10: Error: bad token
//
// Returns one MonacoMarker per match. `filename` is the basename only — the
// caller filters markers against the open file by basename.
const RE = /^(.+?):(\d+)(?::(\d+))?:\s*(?:Error|error|Warning|warning):\s*(.+)$/gm;

export function parseMarkers(stderr: string): MonacoMarker[] {
  const markers: MonacoMarker[] = [];
  // Reset regex state — exec on a /g RegExp is stateful across calls.
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(stderr)) !== null) {
    const fullPath = m[1];
    // Strip directory using both Unix and Windows separators.
    const basename = fullPath.split(/[\\/]/).pop() ?? fullPath;
    markers.push({
      filename: basename,
      startLine: parseInt(m[2], 10),
      startCol: m[3] ? parseInt(m[3], 10) : 1,
      message: m[4],
    });
  }
  return markers;
}
