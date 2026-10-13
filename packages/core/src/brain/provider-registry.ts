import type { BrainCapabilities, BrainProvider, ProviderHealth } from '@mave/contracts';
import { BrainRegistryError } from './types.js';

export class BrainProviderRegistry {
  private readonly providers = new Map<string, BrainProvider>();

  /**
   * Registers a provider instance.
   * Throws BrainRegistryError if provider id is missing/empty or already registered.
   */
  register(provider: BrainProvider): void {
    if (!provider || typeof provider.id !== 'string') {
      throw new BrainRegistryError('invalid_provider_id', 'Provider must have a valid string id');
    }

    const trimmedId = provider.id.trim();
    if (!trimmedId) {
      throw new BrainRegistryError('invalid_provider_id', 'Provider id cannot be empty');
    }

    if (this.providers.has(trimmedId)) {
      throw new BrainRegistryError(
        'duplicate_provider',
        `Provider with id '${trimmedId}' is already registered`
      );
    }

    this.providers.set(trimmedId, provider);
  }

  /**
   * Unregisters a provider by id.
   * Returns true if the provider was found and removed, false otherwise.
   */
  unregister(providerId: string): boolean {
    if (!providerId || typeof providerId !== 'string') {
      return false;
    }
    return this.providers.delete(providerId.trim());
  }

  /**
   * Returns a provider by id, or undefined if not registered.
   */
  get(providerId: string): BrainProvider | undefined {
    if (!providerId || typeof providerId !== 'string') {
      return undefined;
    }
    return this.providers.get(providerId.trim());
  }

  /**
   * Checks whether a provider with the given id is registered.
   */
  has(providerId: string): boolean {
    if (!providerId || typeof providerId !== 'string') {
      return false;
    }
    return this.providers.has(providerId.trim());
  }

  /**
   * Retrieves a provider by id, throwing BrainRegistryError if not registered.
   */
  require(providerId: string): BrainProvider {
    const provider = this.get(providerId);
    if (!provider) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }
    return provider;
  }

  /**
   * Returns all registered providers in deterministic insertion order.
   */
  list(): BrainProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Delegates a health check to the specified provider.
   * Throws BrainRegistryError if the provider is not registered.
   */
  async health(providerId: string): Promise<ProviderHealth> {
    const provider = this.require(providerId);
    return await provider.health();
  }

  /**
   * Retrieves the capabilities of a registered provider without mutating.
   */
  getCapabilities(providerId: string): BrainCapabilities {
    const provider = this.require(providerId);
    return provider.getCapabilities();
  }
}
