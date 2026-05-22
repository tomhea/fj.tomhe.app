// Shared concurrent-job semaphore for REST API subprocess calls.
// Prevents a small number of IPs from exhausting CPU/RAM via parallel compile/convert jobs.
// Overridable via MAX_CONCURRENT_JOBS env var for staging / load-testing.
const MAX = parseInt(process.env.MAX_CONCURRENT_JOBS ?? '10', 10);
let active = 0;

export function acquireJob(): boolean {
  if (active >= MAX) return false;
  active++;
  return true;
}

export function releaseJob(): void {
  active = Math.max(0, active - 1);
}