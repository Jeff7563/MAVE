import { describe, expect, it } from 'vitest';
import {
  RuntimeQuotaStore,
  isQuotaBlocked,
  type RuntimeQuotaState
} from '../brain/quota/index.js';

describe('RuntimeQuotaStore', () => {
  it('returns status "unknown" for unobserved provider', () => {
    const store = new RuntimeQuotaStore();
    const state = store.get('claude-code');

    expect(state.providerId).toBe('claude-code');
    expect(state.status).toBe('unknown');
    expect(state.observedAt).toBe(0);
    expect(state.source).toBe('unknown');
    expect(store.isBlocked('claude-code')).toBe(false);
  });

  it('records quota_limited and rate_limited states and reflects isBlocked = true', () => {
    let mockTime = 1000;
    const store = new RuntimeQuotaStore({ clock: () => mockTime });

    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      source: 'runtime_error',
      reason: 'Usage limit reached'
    });

    expect(store.isBlocked('claude-code')).toBe(true);
    const claudeState = store.get('claude-code');
    expect(claudeState.status).toBe('quota_limited');
    expect(claudeState.reason).toBe('Usage limit reached');
    expect(claudeState.observedAt).toBe(1000);

    store.record({
      providerId: 'codex',
      status: 'rate_limited',
      source: 'runtime_error',
      reason: 'Too many requests'
    });

    expect(store.isBlocked('codex')).toBe(true);
    const codexState = store.get('codex');
    expect(codexState.status).toBe('rate_limited');
  });

  it('records available state and reflects isBlocked = false', () => {
    const store = new RuntimeQuotaStore();

    store.record({
      providerId: 'antigravity',
      status: 'available',
      source: 'successful_execution'
    });

    expect(store.isBlocked('antigravity')).toBe(false);
    expect(store.get('antigravity').status).toBe('available');
  });

  it('protects against stale older observations', () => {
    let mockTime = 2000;
    const store = new RuntimeQuotaStore({ clock: () => mockTime });

    // Newer observation at t=2000
    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      observedAt: 2000,
      source: 'runtime_error'
    });

    // Stale observation arriving out of order with t=1000
    const returned = store.record({
      providerId: 'claude-code',
      status: 'available',
      observedAt: 1000,
      source: 'successful_execution'
    });

    expect(returned.status).toBe('quota_limited');
    expect(store.get('claude-code').status).toBe('quota_limited');
    expect(store.isBlocked('claude-code')).toBe(true);
  });

  it('breaks ties for equal timestamps by favoring higher severity status', () => {
    const store = new RuntimeQuotaStore();

    // t=1000 available
    store.record({
      providerId: 'claude-code',
      status: 'available',
      observedAt: 1000
    });

    // t=1000 quota_limited arrives simultaneously -> quota_limited must win
    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      observedAt: 1000
    });

    expect(store.get('claude-code').status).toBe('quota_limited');
    expect(store.isBlocked('claude-code')).toBe(true);

    // Another t=1000 available arrives -> quota_limited remains
    store.record({
      providerId: 'claude-code',
      status: 'available',
      observedAt: 1000
    });

    expect(store.get('claude-code').status).toBe('quota_limited');
  });

  it('expires to "unknown" (never to "available") after resetAt has passed', () => {
    let mockTime = 1000;
    const store = new RuntimeQuotaStore({ clock: () => mockTime });

    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      observedAt: 1000,
      resetAt: 5000,
      reason: '5h limit reached'
    });

    expect(store.isBlocked('claude-code')).toBe(true);
    expect(store.get('claude-code').status).toBe('quota_limited');

    // Advance clock to right before resetAt
    mockTime = 4999;
    expect(store.isBlocked('claude-code')).toBe(true);

    // Advance clock past resetAt
    mockTime = 5001;
    expect(store.isBlocked('claude-code')).toBe(false);

    const expiredState = store.get('claude-code');
    // Must expire to 'unknown', NEVER automatically to 'available'
    expect(expiredState.status).toBe('unknown');
    expect(expiredState.reason).toContain('expired past reset time');
  });

  it('unlinks state when provider lifecycle token changes', () => {
    let mockTime = 1000;
    const store = new RuntimeQuotaStore({ clock: () => mockTime });

    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      lifecycleToken: 'token-instance-v1'
    });

    expect(store.isBlocked('claude-code', 'token-instance-v1')).toBe(true);

    // New instance registered with different token
    expect(store.isBlocked('claude-code', 'token-instance-v2')).toBe(false);
    expect(store.get('claude-code', 'token-instance-v2').status).toBe('unknown');
  });

  it('allows explicit invalidation of provider quota state', () => {
    const store = new RuntimeQuotaStore();

    store.record({
      providerId: 'codex',
      status: 'quota_limited'
    });
    expect(store.isBlocked('codex')).toBe(true);

    const invalidated = store.invalidate('codex', 'Manual administrative unlock');
    expect(invalidated.status).toBe('unknown');
    expect(store.isBlocked('codex')).toBe(false);
  });

  it('clears expired states via clearExpired()', () => {
    let mockTime = 1000;
    const store = new RuntimeQuotaStore({ clock: () => mockTime });

    store.record({
      providerId: 'p1',
      status: 'quota_limited',
      resetAt: 2000
    });
    store.record({
      providerId: 'p2',
      status: 'rate_limited',
      resetAt: 5000
    });

    mockTime = 3000;
    const cleared = store.clearExpired();
    expect(cleared).toBe(1); // p1 cleared

    expect(store.isBlocked('p1')).toBe(false);
    expect(store.isBlocked('p2')).toBe(true);
  });

  it('sanitizes sensitive tokens and auth headers in reason', () => {
    const store = new RuntimeQuotaStore();

    store.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      reason: 'Authorization failed: Bearer sk-ant-api03-secret-token-value! with key: sk-live-9999'
    });

    const state = store.get('claude-code');
    expect(state.reason).not.toContain('secret-token-value');
    expect(state.reason).not.toContain('sk-ant-api03');
    expect(state.reason).toContain('[REDACTED]');
  });

  it('provides a snapshot and resets completely', () => {
    const store = new RuntimeQuotaStore();
    store.record({ providerId: 'p1', status: 'available' });
    store.record({ providerId: 'p2', status: 'quota_limited' });

    const snap = store.snapshot();
    expect(snap.size).toBe(2);
    expect(snap.get('p1')?.status).toBe('available');
    expect(snap.get('p2')?.status).toBe('quota_limited');

    store.reset();
    expect(store.snapshot().size).toBe(0);
    expect(store.isBlocked('p2')).toBe(false);
  });

  it('isQuotaBlocked helper handles undefined and expiration correctly', () => {
    expect(isQuotaBlocked(undefined)).toBe(false);

    const stateBlocked: RuntimeQuotaState = {
      providerId: 'p',
      status: 'quota_limited',
      observedAt: 1000,
      source: 'unknown'
    };
    expect(isQuotaBlocked(stateBlocked)).toBe(true);

    const stateExpired: RuntimeQuotaState = {
      providerId: 'p',
      status: 'quota_limited',
      observedAt: 1000,
      resetAt: 2000,
      source: 'unknown'
    };
    expect(isQuotaBlocked(stateExpired, 2500)).toBe(false);
  });
});
