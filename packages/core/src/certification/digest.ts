// ============================================================================
// Model Digest Verification Utility (C3.1 / C4-B)
//
// Invariant: Non-destructive verification ONLY.
// Must NEVER trigger model pulls, downloads, or deletions.
// Expected qualified digest: 65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b
// ============================================================================

import {
  QUALIFIED_FAST_BRAIN_DIGEST,
  QUALIFIED_FAST_BRAIN_TAG,
  type DigestCheckResult
} from './types.js';

export interface OllamaModelTagEntry {
  readonly name: string;
  readonly model?: string;
  readonly digest?: string;
  readonly details?: {
    readonly parameter_size?: string;
    readonly quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  readonly models?: readonly OllamaModelTagEntry[];
}

/**
 * Verifies that the promoted model exists in the local Ollama tags
 * and exactly matches the approved qualification digest.
 *
 * Strictly outputs one of:
 * - MATCH
 * - MISMATCH
 * - MODEL_NOT_FOUND
 * - DAEMON_UNAVAILABLE
 */
export function verifyModelDigest(
  tagsResponse: OllamaTagsResponse | null | undefined,
  targetTag: string = QUALIFIED_FAST_BRAIN_TAG,
  expectedDigest: string = QUALIFIED_FAST_BRAIN_DIGEST
): DigestCheckResult {
  if (!tagsResponse) {
    return {
      status: 'DAEMON_UNAVAILABLE',
      modelTag: targetTag,
      expectedDigest,
      details: 'Ollama daemon was not reachable or returned null tags response'
    };
  }

  const models = tagsResponse.models ?? [];
  const normalizedTarget = targetTag.toLowerCase().trim();

  // Look for exact tag match (e.g. "qwen2.5:1.5b" or "qwen2.5:1.5b-instruct")
  const found = models.find((m) => {
    const name = m.name?.toLowerCase().trim();
    const model = m.model?.toLowerCase().trim();
    return name === normalizedTarget || model === normalizedTarget;
  });

  if (!found) {
    return {
      status: 'MODEL_NOT_FOUND',
      modelTag: targetTag,
      expectedDigest,
      details: `Model '${targetTag}' is not installed in local Ollama daemon`
    };
  }

  const actualDigest = found.digest?.toLowerCase().trim() ?? '';
  const expectedLower = expectedDigest.toLowerCase().trim();

  // Normalize sha256: prefix if present in actual digest
  const normalizedActual = actualDigest.startsWith('sha256:')
    ? actualDigest.slice(7)
    : actualDigest;

  const normalizedExpected = expectedLower.startsWith('sha256:')
    ? expectedLower.slice(7)
    : expectedLower;

  if (normalizedActual === normalizedExpected) {
    return {
      status: 'MATCH',
      modelTag: targetTag,
      expectedDigest: normalizedExpected,
      actualDigest: normalizedActual,
      details: `Model '${targetTag}' digest matches approved qualification baseline`
    };
  }

  return {
    status: 'MISMATCH',
    modelTag: targetTag,
    expectedDigest: normalizedExpected,
    actualDigest: normalizedActual,
    details: `Model '${targetTag}' digest mismatch! Expected ${normalizedExpected}, found ${normalizedActual}`
  };
}

/**
 * Asynchronously queries the local Ollama daemon at baseUrl and checks model digest.
 * Non-destructive: queries GET /api/tags only.
 */
export async function checkLocalOllamaDigest(
  baseUrl = 'http://127.0.0.1:11434',
  targetTag = QUALIFIED_FAST_BRAIN_TAG,
  expectedDigest = QUALIFIED_FAST_BRAIN_DIGEST,
  fetchFn: typeof fetch = fetch
): Promise<DigestCheckResult> {
  try {
    const res = await fetchFn(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) {
      return {
        status: 'DAEMON_UNAVAILABLE',
        modelTag: targetTag,
        expectedDigest,
        details: `Ollama returned HTTP status ${res.status}: ${res.statusText}`
      };
    }

    const data = (await res.json()) as OllamaTagsResponse;
    return verifyModelDigest(data, targetTag, expectedDigest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'DAEMON_UNAVAILABLE',
      modelTag: targetTag,
      expectedDigest,
      details: `Failed to connect to Ollama at ${baseUrl}: ${msg}`
    };
  }
}
