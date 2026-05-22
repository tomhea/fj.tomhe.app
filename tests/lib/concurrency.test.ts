import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('acquireJob / releaseJob', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.MAX_CONCURRENT_JOBS;
  });

  it('caps at MAX_CONCURRENT_JOBS env override', async () => {
    process.env.MAX_CONCURRENT_JOBS = '3';
    const { acquireJob, releaseJob } = await import('@/lib/concurrency');
    expect(acquireJob()).toBe(true);
    expect(acquireJob()).toBe(true);
    expect(acquireJob()).toBe(true);
    expect(acquireJob()).toBe(false); // 4th acquire fails
    releaseJob();
    expect(acquireJob()).toBe(true); // slot freed
    releaseJob();
    releaseJob();
    releaseJob();
  });

  it('defaults to MAX_CONCURRENT_JOBS=10 when env is unset', async () => {
    const { acquireJob, releaseJob } = await import('@/lib/concurrency');
    let acquired = 0;
    while (acquireJob()) acquired++;
    expect(acquired).toBe(10);
    for (let i = 0; i < acquired; i++) releaseJob();
  });

  it('releaseJob clamps active to zero (no negative)', async () => {
    const { acquireJob, releaseJob } = await import('@/lib/concurrency');
    releaseJob(); // below zero → clamps, does not throw
    expect(acquireJob()).toBe(true);
    releaseJob();
  });
});
