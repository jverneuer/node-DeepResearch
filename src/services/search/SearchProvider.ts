/**
 * Search Provider - Abstract interface for search providers
 *
 * Supports multiple providers (Jina, Brave, Serper)
 * with unified interface and error handling
 */

import { z } from 'zod';
import type { SearchProviderConfig } from '@core/types/schemas.js';

/**
 * Search query
 */
export interface SearchQuery {
  readonly query: string;
  readonly count?: number;
  readonly offset?: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  readonly maxResults?: number;
  readonly timeout?: number;
  readonly safeSearch?: boolean;
  readonly country?: string;
  readonly language?: string;
}

/**
 * Search result
 */
export interface SearchResult {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly relevance?: number;
  readonly publishedDate?: Date;
  readonly author?: string;
}

/**
 * Search response
 */
export interface SearchResponse {
  readonly results: ReadonlyArray<SearchResult>;
  readonly totalResults: number;
  readonly query: string;
  readonly timestamp: Date;
}

/**
 * Search Provider interface
 */
export interface SearchProvider {
  /**
   * Get provider name
   */
  readonly name: string;

  /**
   * Perform search
   */
  search(query: string, options?: SearchOptions): Promise<ReadonlyArray<SearchResult>>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get configuration
   */
  getConfig(): SearchProviderConfig;
}

/**
 * Provider-specific configurations
 */

export interface JinaConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly maxResults?: number;
  readonly timeout?: number;
}

export interface BraveConfig {
  readonly apiKey: string;
  readonly maxResults?: number;
  readonly timeout?: number;
}

export interface SerperConfig {
  readonly apiKey: string;
  readonly maxResults?: number;
  readonly timeout?: number;
}

/**
 * Validation schemas
 */
export const SearchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  relevance: z.number().min(0).max(1).optional(),
  publishedDate: z.date().optional(),
  author: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  totalResults: z.number().int().nonnegative(),
  query: z.string(),
  timestamp: z.date(),
});

export type ValidatedSearchResult = z.infer<typeof SearchResultSchema>;
export type ValidatedSearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Validate search result
 */
export function validateSearchResult(data: unknown): ValidatedSearchResult {
  return SearchResultSchema.parse(data);
}

/**
 * Validate search response
 */
export function validateSearchResponse(data: unknown): ValidatedSearchResponse {
  return SearchResponseSchema.parse(data);
}

/**
 * Calculate relevance score
 */
export function calculateRelevance(
  result: SearchResult,
  query: string
): number {
  const queryLower = query.toLowerCase();
  const titleLower = result.title.toLowerCase();
  const snippetLower = result.snippet.toLowerCase();

  let score = 0;

  // Exact match in title
  if (titleLower.includes(queryLower)) {
    score += 0.5;
  }

  // Partial match in title
  const queryWords = queryLower.split(/\s+/);
  const titleWords = titleLower.split(/\s+/);
  const titleMatches = queryWords.filter((word) => titleWords.includes(word));
  score += (titleMatches.length / queryWords.length) * 0.3;

  // Match in snippet
  const snippetWords = snippetLower.split(/\s+/);
  const snippetMatches = queryWords.filter((word) => snippetWords.includes(word));
  score += (snippetMatches.length / queryWords.length) * 0.2;

  return Math.min(score, 1);
}

/**
 * Sort search results by relevance
 */
export function sortByRelevance(
  results: ReadonlyArray<SearchResult>,
  query: string
): ReadonlyArray<SearchResult> {
  return [...results]
    .map((result) => ({
      ...result,
      relevance: result.relevance ?? calculateRelevance(result, query),
    }))
    .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
}

/**
 * Deduplicate search results by URL
 */
export function deduplicateResults(
  results: ReadonlyArray<SearchResult>
): ReadonlyArray<SearchResult> {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
}

/**
 * Filter low-quality results
 */
export function filterQuality(
  results: ReadonlyArray<SearchResult>,
  minRelevance: number = 0.2
): ReadonlyArray<SearchResult> {
  return results.filter((result) => {
    // Must have a title and snippet
    if (!result.title || !result.snippet) {
      return false;
    }

    // Check relevance if available
    if (result.relevance !== undefined && result.relevance < minRelevance) {
      return false;
    }

    return true;
  });
}

/**
 * Process search results pipeline
 */
export function processSearchResults(
  results: ReadonlyArray<SearchResult>,
  query: string,
  options?: {
    deduplicate?: boolean;
    sortByRelevance?: boolean;
    minRelevance?: number;
  }
): ReadonlyArray<SearchResult> {
  let processed = [...results];

  if (options?.deduplicate !== false) {
    processed = deduplicateResults(processed);
  }

  if (options?.sortByRelevance !== false) {
    processed = sortByRelevance(processed, query);
  }

  if (options?.minRelevance !== undefined) {
    processed = filterQuality(processed, options.minRelevance);
  }

  return processed;
}
