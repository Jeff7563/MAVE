import { describe, expect, it } from 'vitest';
import {
  parseClaudeQuotaSignal,
  parseCodexQuotaSignal,
  parseAntigravityQuotaSignal
} from '../brain/index.js';

describe('Provider Quota Signal Parsers (F1.5-S4.1)', () => {
  describe('Claude Code Quota Parser', () => {
    it('detects runtime-scoped rate_limit_event with rejected status', () => {
      const event = {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'rejected',
          rateLimitType: 'five_hour',
          unifiedWindows: {
            five_hour: {
              utilization: 1.0,
              resetsAt: 1718000000000
            }
          }
        }
      };

      const signal = parseClaudeQuotaSignal('', event);
      expect(signal.isQuota).toBe(true);
      expect(signal.code).toBe('quota_limited');
      expect(signal.scope).toBe('runtime');
      expect(signal.resetAt).toBe(1718000000000);
      expect(signal.windowType).toBe('five_hour');
    });

    it('detects runtime-scoped text errors (account/plan limits)', () => {
      const text = 'Claude Code CLI error: Your account limit has been reached. Please wait for seven_day window to reset.';
      const signal = parseClaudeQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('runtime');
      expect(signal.code).toBe('quota_limited');
    });

    it('detects model-scoped text errors (specific model capacity)', () => {
      const text = 'Claude Code error: claude-3-opus model capacity exceeded for this tier. Model capacity limit reached.';
      const signal = parseClaudeQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('model');
      expect(signal.modelId).toBe('claude-3-opus');
    });

    it('detects model-scoped text errors for sonnet', () => {
      const text = 'Claude Code error: sonnet is currently experiencing high load and rate limit.';
      const signal = parseClaudeQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('model');
      expect(signal.modelId).toBe('claude-3-5-sonnet');
    });

    it('falls back to unknown scope for generic 429 without account or model context', () => {
      const text = 'HTTP 429: Too Many Requests';
      const signal = parseClaudeQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('unknown');
      expect(signal.code).toBe('rate_limited');
    });

    it('returns isQuota = false for non-quota errors', () => {
      const text = 'Error: authentication failed with code 401';
      const signal = parseClaudeQuotaSignal(text);

      expect(signal.isQuota).toBe(false);
    });
  });

  describe('OpenAI Codex Quota Parser', () => {
    it('detects runtime-scoped ChatGPT plan/usage limits', () => {
      const text = 'You have reached your usage limit for ChatGPT Plus. Try again after reset.';
      const signal = parseCodexQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('runtime');
      expect(signal.code).toBe('quota_limited');
    });

    it('detects runtime-scoped ChatGPT account limit', () => {
      const text = 'ChatGPT account limit reached. Your subscription plan limit has been exhausted.';
      const signal = parseCodexQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('runtime');
      expect(signal.code).toBe('quota_limited');
    });

    it('detects model-scoped limits for gpt-4o and o1', () => {
      const text4o = 'OpenAI Codex error: Rate limit reached for gpt-4o model capacity. Try a different model.';
      const signal4o = parseCodexQuotaSignal(text4o);

      expect(signal4o.isQuota).toBe(true);
      expect(signal4o.scope).toBe('model');
      expect(signal4o.modelId).toBe('gpt-4o');

      const texto1 = 'Error: o1-mini capacity limit reached. Too many requests.';
      const signalo1 = parseCodexQuotaSignal(texto1);

      expect(signalo1.isQuota).toBe(true);
      expect(signalo1.scope).toBe('model');
      expect(signalo1.modelId).toBe('o1-mini');
    });

    it('extracts resetAt from json error payload', () => {
      const json = JSON.stringify({
        error: {
          message: 'Rate limit reached for gpt-4o',
          resets_at: 1719999999000
        }
      });
      const signal = parseCodexQuotaSignal(json);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('model');
      expect(signal.modelId).toBe('gpt-4o');
      expect(signal.resetAt).toBe(1719999999000);
    });

    it('falls back to unknown scope for generic 429 without plan or model specificity', () => {
      const text = '429 too many requests';
      const signal = parseCodexQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('unknown');
    });

    it('returns isQuota = false for non-quota errors', () => {
      const text = 'Unauthorized: Invalid token or login required';
      const signal = parseCodexQuotaSignal(text);

      expect(signal.isQuota).toBe(false);
    });
  });

  describe('Google Antigravity Quota Parser', () => {
    it('detects runtime-scoped project or account quotas', () => {
      const text = 'RESOURCE_EXHAUSTED: Daily quota or project quota exceeded for Antigravity subscription.';
      const signal = parseAntigravityQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('runtime');
      expect(signal.code).toBe('quota_limited');
    });

    it('detects model-scoped limits for specific gemini models', () => {
      const text = 'RESOURCE_EXHAUSTED: GenerateContentRequestsPerMinutePerModel quota exceeded for gemini-1.5-pro.';
      const signal = parseAntigravityQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('model');
      expect(signal.modelId).toBe('gemini-1.5-pro');
    });

    it('detects model-scoped limits mentioning flash model', () => {
      const text = 'Quota limit reached for gemini-1.5-flash.';
      const signal = parseAntigravityQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('model');
      expect(signal.modelId).toBe('gemini-1.5-flash');
    });

    it('falls back to unknown scope for generic RESOURCE_EXHAUSTED without model or account specifics', () => {
      const text = 'Error: RESOURCE_EXHAUSTED returned from Antigravity CLI';
      const signal = parseAntigravityQuotaSignal(text);

      expect(signal.isQuota).toBe(true);
      expect(signal.scope).toBe('unknown');
    });

    it('returns isQuota = false for unrelated errors', () => {
      const text = 'Process exit code 1: internal error';
      const signal = parseAntigravityQuotaSignal(text);

      expect(signal.isQuota).toBe(false);
    });
  });
});
