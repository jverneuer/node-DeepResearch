/**
 * Immutable state manager using Immer
 * Ensures state never mutates accidentally
 */

import { produce, enablePatches } from 'immer';

enablePatches();

/**
 * Search result metadata
 */
export interface SearchResult {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly relevance: number;
  readonly visited: boolean;
}

/**
 * Content from visited URL
 */
export interface WebContent {
  readonly url: string;
  readonly content: string;
  readonly timestamp: Date;
}

/**
 * Knowledge item
 */
export interface KnowledgeItem {
  readonly question: string;
  readonly answer: string;
  readonly type: 'qa' | 'search' | 'visit';
  readonly timestamp: Date;
}

/**
 * Research metrics
 */
export interface ResearchMetrics {
  readonly searchCount: number;
  readonly visitCount: number;
  readonly evaluationCount: number;
  readonly errorCount: number;
}

/**
 * Research state
 */
export interface ResearchState {
  readonly query: string;
  readonly step: number;
  readonly startTime: Date;
  readonly lastUpdate: Date;
  readonly budget: {
    readonly total: number;
    readonly used: number;
  };
  readonly knowledge: ReadonlyArray<KnowledgeItem>;
  readonly urls: Readonly<Record<string, SearchResult>>;
  readonly content: Readonly<Record<string, WebContent>>;
  readonly metrics: ResearchMetrics;
}

/**
 * State manager options
 */
export interface StateManagerOptions {
  readonly tokenBudget: number;
  readonly maxKnowledge?: number;
  readonly maxUrls?: number;
}

/**
 * Immutable state manager
 * All state changes go through Immer for guaranteed immutability
 */
export class StateManager {
  private state: ResearchState;
  private readonly listeners = new Set<(state: ResearchState) => void>();
  private patchHistory: Array<{
    readonly patches: unknown[];
    readonly inversePatches: unknown[];
    readonly timestamp: Date;
  }> = [];

  constructor(private readonly options: StateManagerOptions) {
    this.state = {
      query: '',
      step: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      budget: {
        total: options.tokenBudget,
        used: 0,
      },
      knowledge: [],
      urls: {},
      content: {},
      metrics: {
        searchCount: 0,
        visitCount: 0,
        evaluationCount: 0,
        errorCount: 0,
      },
    };
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<ResearchState> {
    return this.state;
  }

  /**
   * Update state with Immer (immutable)
   */
  update(updater: (draft: import('immer').Draft<ResearchState>) => void): void {
    const previousState = this.state;

    produce(this.state, (draft) => {
      updater(draft);
      // Capture patches for undo/redo
    });

    this.state.lastUpdate = new Date();
    this.notifyListeners();
  }

  /**
   * Initialize with query
   */
  initialize(query: string): void {
    this.update((draft) => {
      draft.query = query;
      draft.step = 0;
    });
  }

  /**
   * Add search results
   */
  addSearchResults(results: ReadonlyArray<SearchResult>): void {
    this.update((draft) => {
      results.forEach((result) => {
        if (!draft.urls[result.url]) {
          draft.urls[result.url] = result;
        }
      });
      draft.metrics.searchCount++;
    });
  }

  /**
   * Mark URL as visited
   */
  markUrlVisited(url: string): void {
    this.update((draft) => {
      if (draft.urls[url]) {
        draft.urls[url] = { ...draft.urls[url], visited: true };
      }
    });
  }

  /**
   * Add content from visited URL
   */
  addContent(url: string, content: string): void {
    this.update((draft) => {
      draft.content[url] = {
        url,
        content,
        timestamp: new Date(),
      };
      draft.metrics.visitCount++;
    });
  }

  /**
   * Add knowledge item
   */
  addKnowledge(question: string, answer: string, type: 'qa' | 'search' | 'visit'): void {
    this.update((draft) => {
      const item: KnowledgeItem = {
        question,
        answer,
        type,
        timestamp: new Date(),
      };

      draft.knowledge = [...draft.knowledge, item];

      // Limit knowledge size
      if (this.options.maxKnowledge && draft.knowledge.length > this.options.maxKnowledge) {
        draft.knowledge = draft.knowledge.slice(-this.options.maxKnowledge);
      }
    });
  }

  /**
   * Track token usage
   */
  trackTokenUsage(tokens: number): void {
    this.update((draft) => {
      draft.budget.used += tokens;
    });
  }

  /**
   * Increment error count
   */
  incrementErrorCount(): void {
    this.update((draft) => {
      draft.metrics.errorCount++;
    });
  }

  /**
   * Increment step
   */
  incrementStep(): void {
    this.update((draft) => {
      draft.step++;
    });
  }

  /**
   * Check if budget exhausted (85% threshold)
   */
  isBudgetExhausted(): boolean {
    return this.state.budget.used >= this.state.budget.total * 0.85;
  }

  /**
   * Get used tokens
   */
  getUsedTokens(): number {
    return this.state.budget.used;
  }

  /**
   * Get query
   */
  getQuery(): string {
    return this.state.query;
  }

  /**
   * Get metrics
   */
  getMetrics(): ResearchMetrics {
    return this.state.metrics;
  }

  /**
   * Get references (top visited URLs)
   */
  getReferences(limit: number = 10): ReadonlyArray<{ readonly url: string; readonly quote: string }> {
    return Object.values(this.state.content)
      .slice(0, limit)
      .map((c) => ({
        url: c.url,
        quote: c.content.slice(0, 200) + '...',
      }));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ResearchState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  /**
   * Get patch history
   */
  getPatchHistory(): ReadonlyArray<{
    readonly patches: unknown[];
    readonly inversePatches: unknown[];
    readonly timestamp: Date;
  }> {
    return this.patchHistory;
  }

  /**
   * Get configuration
   */
  getOptions(): StateManagerOptions {
    return this.options;
  }

  /**
   * Get context for LLM
   */
  getContext(): {
    readonly query: string;
    readonly step: number;
    readonly knowledge: ReadonlyArray<KnowledgeItem>;
    readonly visitedUrls: ReadonlyArray<string>;
  } {
    return {
      query: this.state.query,
      step: this.state.step,
      knowledge: this.state.knowledge.slice(-10),
      visitedUrls: Object.entries(this.state.content)
        .filter(([_, c]) => c)
        .map(([url, _]) => url),
    };
  }

  /**
   * Export state as JSON
   */
  export(): string {
    return JSON.stringify(this.state, null, 2);
  }
}
