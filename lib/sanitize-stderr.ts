/**
 * Strips Python traceback frame lines from stderr output to avoid exposing
 * server-side filesystem paths (e.g. /root/.venv/lib/python3.12/…).
 *
 * The final exception message line (e.g. "FlipJumpError: unknown label 'x'")
 * is preserved — only the stack frames themselves are dropped.
 *
 * Safe to call on streaming chunks: all filtered patterns are whole lines.
 */
export function sanitizeStderr(text: string): string {
  return text
    .split('\n')
    .filter(line => {
      // Python traceback frame: '  File "/absolute/path", line N, in func'
      if (/^\s+File "\//.test(line)) return false;
      // Traceback header line
      if (line.trimEnd() === 'Traceback (most recent call last):') return false;
      // Chained-exception separators
      if (/^During handling of the above exception/.test(line.trimStart())) return false;
      if (/^The above exception was the direct cause/.test(line.trimStart())) return false;
      return true;
    })
    .join('\n');
}
