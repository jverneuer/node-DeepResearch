/**
 * Research Agent - Main orchestration with guaranteed termination
 *
 * This agent uses the StateMachine pattern to ensure the research process
 * always terminates (no infinite loops). It coordinates:
 * - LLM calls for decision making
 * - Search for finding relevant information
 * - Content reading for gathering details
 * - Evaluation for assessing progress
 * - Reflection for planning next steps
 */

import { StateMachine } from '@core/base/StateMachine.js';
import type { StateManager } from '@core/base/StateManager.js';
import type {
  AgentState,
  AgentConfig,
  ResearchResult,
  TerminalState,
} from '@core/types/agent.js';
import type { AgentAction } from '@core/types/actions.js';
import type { LLMProvider } from '@services/llm/LLMProvider.js';
import type { SearchProvider } from '@services/search/SearchProvider.js';
import { ContentReader } from '@services/content/ContentReader.js';
import {
  isIdle,
  isInitializing,
  isSearching,
  isReading,
  isEvaluating,
  isReflecting,
  isTerminal,
} from '@core/types/agent.js';
import {
  ConfigurationError,
  LLMError,
  SearchError,
  ContentError,
} from '@core/types/errors.js';
import type { SearchResult as StateManagerSearchResult } from '@core/base/StateManager.js';

/**
 * Research agent options
 */
export interface ResearchAgentOptions {
  readonly llmProvider: LLMProvider;
  readonly searchProvider: SearchProvider;
  readonly contentReader: ContentReader;
}

/**
 * Research Agent - Main orchestration class
 */
export class ResearchAgent {
  private readonly stateMachine: StateMachine<AgentState, AgentConfig & ResearchAgentOptions>;
  private readonly stateManager: StateManager;
  private readonly config: AgentConfig & ResearchAgentOptions;

  constructor(
    config: AgentConfig,
    options: ResearchAgentOptions,
    stateManager: StateManager
  ) {
    this.config = { ...config, ...options };
    this.stateManager = stateManager;

    // Create state machine with transition handlers
    this.stateMachine = this.createStateMachine();
  }

  /**
   * Execute research with guaranteed termination
   */
  async research(query: string): Promise<ResearchResult> {
    try {
      // Initialize
      this.stateManager.initialize(query);

      // Run state machine (guaranteed to terminate)
      const finalState = await this.stateMachine.run();

      // Validate terminal state
      if (!isTerminal(finalState)) {
        throw new Error('Research terminated in non-terminal state');
      }

      // Return result based on terminal state
      return this.buildResult(finalState);
    } catch (error) {
      // Handle and transform errors
      throw this.handleError(error);
    }
  }

  /**
   * Cancel ongoing research
   */
  cancel(reason: string): void {
    this.stateMachine.cancel(reason);
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<AgentState> {
    return this.stateMachine.getState();
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.stateMachine.getStepCount();
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return this.stateMachine.getElapsedTime();
  }

  /**
   * Create state machine with all transition handlers
   */
  private createStateMachine(): StateMachine<AgentState, AgentConfig & ResearchAgentOptions> {
    const initialState: AgentState = {
      status: 'idle',
    };

    const options = {
      maxSteps: this.config.maxSteps,
      maxDuration: this.config.maxDuration,
      timeout: this.config.timeout,
      onStateChange: (from: AgentState, to: AgentState) => {
        this.handleStateChange(from, to);
      },
    };

    const handlers = {
      // Idle → Initializing
      idle: this.handleIdle.bind(this),

      // Initializing → Searching
      initializing: this.handleInitializing.bind(this),

      // Searching → Reading or Evaluating
      searching: this.handleSearching.bind(this),

      // Reading → Evaluating
      reading: this.handleReading.bind(this),

      // Evaluating → Searching, Reflecting, or Completed
      evaluating: this.handleEvaluating.bind(this),

      // Reflecting → Searching or Completed
      reflecting: this.handleReflecting.bind(this),
    };

    const validators = {
      idle: (state: AgentState) => isIdle(state),
      initializing: (state: AgentState) => isInitializing(state),
      searching: (state: AgentState) => isSearching(state),
      reading: (state: AgentState) => isReading(state),
      evaluating: (state: AgentState) => isEvaluating(state),
      reflecting: (state: AgentState) => isReflecting(state),
    };

    return new StateMachine(initialState, this.config, options, new Map(Object.entries(handlers)), new Map(Object.entries(validators)));
  }

  /**
   * Handle idle state - transition to initializing
   */
  private async handleIdle(
    state: AgentState,
    _config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isIdle(state)) {
      throw new Error('Invalid state for idle handler');
    }

    const query = this.stateManager.getQuery();

    if (!query) {
      throw new ConfigurationError('Query not initialized', {});
    }

    return {
      status: 'initializing',
      context: {
        query,
        startTime: new Date(),
      },
    };
  }

  /**
   * Handle initializing state - prepare for search
   */
  private async handleInitializing(
    state: AgentState,
    _config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isInitializing(state)) {
      throw new Error('Invalid state for initializing handler');
    }

    this.stateManager.incrementStep();

    return {
      status: 'searching',
      step: 1,
      query: state.context.query,
    };
  }

  /**
   * Handle searching state - perform search
   */
  private async handleSearching(
    state: AgentState,
    config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isSearching(state)) {
      throw new Error('Invalid state for searching handler');
    }

    try {
      // Perform search
      const results = await config.searchProvider.search(state.query, {
        maxResults: 10,
      });

      // Convert search results to StateManager format
      const convertedResults: ReadonlyArray<StateManagerSearchResult> = results.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        relevance: r.relevance ?? 0.5,
        visited: false,
      }));

      // Add results to state manager
      this.stateManager.addSearchResults(convertedResults);

      // Decide what to do next using LLM
      const action = await this.decideNextAction();

      if (action.type === 'visit') {
        // Visit the first URL
        const firstUrl = action.urls[0];
        if (!firstUrl) {
          throw new Error('No URLs to visit');
        }
        return {
          status: 'reading',
          step: state.step,
          url: firstUrl.url,
        };
      } else if (action.type === 'search') {
        // Continue searching
        return {
          status: 'searching',
          step: state.step + 1,
          query: action.queries[0]?.query || state.query,
        };
      } else if (action.type === 'answer') {
        // Ready to answer
        return {
          status: 'evaluating',
          step: state.step,
          answer: action.answer,
        };
      } else {
        // Default to searching
        return {
          status: 'searching',
          step: state.step + 1,
          query: state.query,
        };
      }
    } catch (error) {
      this.stateManager.incrementErrorCount();
      const errorContext: { provider: string; query: string; statusCode?: number } = {
        provider: 'search',
        query: state.query,
      };
      if (error instanceof Error && 'status' in error) {
        const statusCode = parseInt(error.status as string);
        if (!isNaN(statusCode)) {
          errorContext.statusCode = statusCode;
        }
      }
      throw new SearchError('Search failed', errorContext);
    }
  }

  /**
   * Handle reading state - read and process content
   */
  private async handleReading(
    state: AgentState,
    _config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isReading(state)) {
      throw new Error('Invalid state for reading handler');
    }

    try {
      // Read content
      const content = await this.config.contentReader.read(state.url);

      // Mark URL as visited
      this.stateManager.markUrlVisited(state.url);

      // Add content
      this.stateManager.addContent(state.url, content);

      // Extract knowledge using LLM
      const knowledge = await this.extractKnowledge(content, state.url);

      // Add to knowledge base
      this.stateManager.addKnowledge(
        state.url,
        knowledge,
        'visit'
      );

      // Move to evaluating
      return {
        status: 'evaluating',
        step: state.step,
        answer: `Visited ${state.url}`,
      };
    } catch (error) {
      this.stateManager.incrementErrorCount();
      throw new ContentError('Failed to read content', state.url, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Handle evaluating state - assess progress
   */
  private async handleEvaluating(
    state: AgentState,
    _config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isEvaluating(state)) {
      throw new Error('Invalid state for evaluating handler');
    }

    // Check if we should continue
    const shouldContinue = await this.shouldContinueResearch();

    if (shouldContinue) {
      // Reflect on progress
      return {
        status: 'reflecting',
        step: state.step,
        feedback: 'Evaluating progress',
      };
    } else {
      // We're done - generate final answer
      const finalAnswer = await this.generateFinalAnswer();

      return {
        status: 'completed',
        answer: finalAnswer.answer,
        references: finalAnswer.references,
      };
    }
  }

  /**
   * Handle reflecting state - plan next steps
   */
  private async handleReflecting(
    state: AgentState,
    _config: AgentConfig & ResearchAgentOptions
  ): Promise<AgentState> {
    if (!isReflecting(state)) {
      throw new Error('Invalid state for reflecting handler');
    }

    // Generate next action
    const action = await this.decideNextAction();

    if (action.type === 'search') {
      return {
        status: 'searching',
        step: state.step + 1,
        query: action.queries[0]?.query || this.stateManager.getQuery(),
      };
    } else if (action.type === 'visit') {
      const firstUrl = action.urls[0];
      if (!firstUrl) {
        throw new Error('No URLs to visit');
      }
      return {
        status: 'reading',
        step: state.step,
        url: firstUrl.url,
      };
    } else if (action.type === 'answer') {
      return {
        status: 'completed',
        answer: action.answer,
        references: action.references,
      };
    } else {
      // Default to completed
      const finalAnswer = await this.generateFinalAnswer();
      return {
        status: 'completed',
        answer: finalAnswer.answer,
        references: finalAnswer.references,
      };
    }
  }

  /**
   * Decide next action using LLM
   */
  private async decideNextAction(): Promise<AgentAction> {
    const context = this.stateManager.getContext();

    const prompt = this.buildDecisionPrompt(context);

    try {
      const response = await this.config.llmProvider.generate({
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Decide the next action.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Parse action from response
      return this.parseAction(response.content);
    } catch (error) {
      const errorContext: { provider: string; model: string; statusCode?: number } = {
        provider: this.config.llmProvider.name,
        model: this.config.llmProvider.model,
      };
      if (error instanceof Error && 'status' in error) {
        const statusCode = parseInt(error.status as string);
        if (!isNaN(statusCode)) {
          errorContext.statusCode = statusCode;
        }
      }
      throw new LLMError('Failed to decide next action', errorContext);
    }
  }

  /**
   * Extract knowledge from content
   */
  private async extractKnowledge(_content: string, url: string): Promise<string> {
    try {
      const response = await this.config.llmProvider.generate({
        messages: [
          {
            role: 'system',
            content: 'Extract key information from the following content.',
          },
          {
            role: 'user',
            content: `Content from ${url}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      return response.content;
    } catch (error) {
      const errorContext: { provider: string; model: string; statusCode?: number } = {
        provider: this.config.llmProvider.name,
        model: this.config.llmProvider.model,
      };
      if (error instanceof Error && 'status' in error) {
        const statusCode = parseInt(error.status as string);
        if (!isNaN(statusCode)) {
          errorContext.statusCode = statusCode;
        }
      }
      throw new LLMError('Failed to extract knowledge', errorContext);
    }
  }

  /**
   * Check if research should continue
   */
  private async shouldContinueResearch(): Promise<boolean> {
    const metrics = this.stateManager.getMetrics();

    // Stop conditions
    if (this.stateManager.isBudgetExhausted()) {
      return false;
    }

    if (metrics.errorCount >= this.config.maxBadAttempts) {
      return false;
    }

    // Ask LLM if we should continue
    const context = this.stateManager.getContext();

    try {
      const response = await this.config.llmProvider.generate({
        messages: [
          {
            role: 'system',
            content: 'Decide if the research is complete. Answer "yes" or "no".',
          },
          {
            role: 'user',
            content: `Query: ${context.query}\n\nKnowledge gathered: ${context.knowledge.length} items`,
          },
        ],
        temperature: 0.1,
        maxTokens: 10,
      });

      return !response.content.toLowerCase().includes('yes');
    } catch (error) {
      // On error, stop to be safe
      return false;
    }
  }

  /**
   * Generate final answer
   */
  private async generateFinalAnswer(): Promise<{
    answer: string;
    references: ReadonlyArray<{ url: string; quote: string }>;
  }> {
    const context = this.stateManager.getContext();
    const references = this.stateManager.getReferences(10);

    try {
      const response = await this.config.llmProvider.generate({
        messages: [
          {
            role: 'system',
            content: 'Generate a comprehensive answer based on the research.',
          },
          {
            role: 'user',
            content: `Query: ${context.query}\n\nKnowledge: ${JSON.stringify(context.knowledge, null, 2)}`,
          },
        ],
        temperature: 0.5,
        maxTokens: 3000,
      });

      return {
        answer: response.content,
        references,
      };
    } catch (error) {
      const errorContext: { provider: string; model: string; statusCode?: number } = {
        provider: this.config.llmProvider.name,
        model: this.config.llmProvider.model,
      };
      if (error instanceof Error && 'status' in error) {
        const statusCode = parseInt(error.status as string);
        if (!isNaN(statusCode)) {
          errorContext.statusCode = statusCode;
        }
      }
      throw new LLMError('Failed to generate final answer', errorContext);
    }
  }

  /**
   * Parse action from LLM response
   */
  private parseAction(content: string): AgentAction {
    try {
      // Try to parse as JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed as AgentAction;
      }

      // Default to search action
      return {
        type: 'search',
        id: crypto.randomUUID(),
        timestamp: new Date(),
        think: content,
        queries: [{ query: this.stateManager.getQuery(), priority: 'high' }],
      };
    } catch (error) {
      throw new LLMError('Failed to parse action', {
        provider: this.config.llmProvider.name,
        model: this.config.llmProvider.model,
      });
    }
  }

  /**
   * Build decision prompt for LLM
   */
  private buildDecisionPrompt(context: {
    query: string;
    step: number;
    knowledge: ReadonlyArray<{ question: string; answer: string; type: string }>;
    visitedUrls: ReadonlyArray<string>;
  }): string {
    return `
Current Query: ${context.query}
Step: ${context.step}

Knowledge Gathered:
${context.knowledge.map((k, i) => `${i + 1}. ${k.question}\n   ${k.answer}`).join('\n')}

Visited URLs:
${context.visitedUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Decide the next action. Respond with JSON:
{
  "type": "search" | "visit" | "answer",
  "queries": [...],  // if search
  "urls": [...],    // if visit
  "answer": "...",  // if answer
  "references": [...]  // if answer
}
`;
  }

  /**
   * Build final result
   */
  private buildResult(state: TerminalState): ResearchResult {
    if (state.status === 'completed') {
      return {
        query: this.stateManager.getQuery(),
        answer: state.answer,
        references: state.references,
        metrics: this.stateManager.getMetrics(),
        duration: this.stateMachine.getElapsedTime(),
        steps: this.stateMachine.getStepCount(),
      };
    } else if (state.status === 'failed') {
      return {
        query: this.stateManager.getQuery(),
        answer: `Research failed: ${state.error}`,
        references: [],
        metrics: this.stateManager.getMetrics(),
        duration: this.stateMachine.getElapsedTime(),
        steps: this.stateMachine.getStepCount(),
      };
    } else {
      return {
        query: this.stateManager.getQuery(),
        answer: `Research cancelled: ${state.reason}`,
        references: [],
        metrics: this.stateManager.getMetrics(),
        duration: this.stateMachine.getElapsedTime(),
        steps: this.stateMachine.getStepCount(),
      };
    }
  }

  /**
   * Handle state changes
   */
  private handleStateChange(from: AgentState, to: AgentState): void {
    // Log or notify state changes
    console.log(`State transition: ${from.status} → ${to.status}`);
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }
}
