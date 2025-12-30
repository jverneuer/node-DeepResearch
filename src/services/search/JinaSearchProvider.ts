/**
 * Jina Search Provider
 *
 * Implements search provider interface for Jina Search API
 */

import type {
  SearchProvider,
  SearchResult,
  SearchOptions,
} from './SearchProvider.js';
import type { SearchProviderConfig } from '@core/types/schemas.js';

interface JinaConfig extends SearchProviderConfig {
  readonly name: 'jina';
}

interface JinaSearchResponse {
  readonly data: ReadonlyArray<{
    readonly title: string;
    readonly url: string;
    readonly content: string;
    readonly description?: string;
    readonly author?: string;
    readonly date?: string;
  }>;
}

/**
 * Jina Search Provider implementation
 */
export class JinaSearchProvider implements SearchProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly maxResults: number;
  private readonly timeout: number;

  constructor(config: JinaConfig) {
    this.name = 'jina';
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults || 10;
    this.timeout = config.timeout || 10000;
  }

  /**
   * Perform search
   */
  async search(query: string, options?: SearchOptions): Promise<ReadonlyArray<SearchResult>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || this.timeout);

    try {
      const maxResults = options?.maxResults || this.maxResults;

      const response = await fetch(`https://s.jina.ai/http://www.google.com/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.statusText}`);
      }

      const text = await response.text();

      // Parse JSON response (Jina returns plain text that's JSON formatted)
      const data: JinaSearchResponse = JSON.parse(text);

      // Transform to our format
      const results: SearchResult[] = data.data.slice(0, maxResults).map((item) => ({
        url: item.url,
        title: item.title,
        snippet: item.description || item.content.slice(0, 200),
        relevance: 0.5, // Jina doesn't provide relevance
      }));

      return results;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Search request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`https://s.jina.ai/http://www.google.com/search?q=test`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): SearchProviderConfig {
    return {
      name: 'jina',
      apiKey: this.apiKey,
      maxResults: this.maxResults,
      timeout: this.timeout,
    };
  }
}
