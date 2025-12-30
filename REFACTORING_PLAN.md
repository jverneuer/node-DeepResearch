# DeepResearch Refactoring Plan
## Modern TypeScript Architecture

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Phase 1: Foundation](#phase-1-foundation)
3. [Phase 2: Core Loop Refactor](#phase-2-core-loop-refactor)
4. [Phase 3: Type Safety](#phase-3-type-safety)
5. [Phase 4: State Management](#phase-4-state-management)
6. [Phase 5: Error Handling](#phase-5-error-handling)
7. [Phase 6: Testing](#phase-6-testing)
8. [Phase 7: Observability](#phase-7-observability)
9. [Modern TypeScript Features](#modern-typescript-features)
10. [Migration Strategy](#migration-strategy)

---

## Executive Summary

### Current State
- ❌ Infinite loop bugs (3 critical)
- ❌ Poor type safety (any types, loose interfaces)
- ❌ No error boundaries
- ❌ Mutable state everywhere
- ❌ No testing infrastructure
- ❌ Procedural code in functional paradigm

### Target State
- ✅ Finite, predictable execution
- ✅ Strict type safety (no `any`, discriminated unions)
- ✅ Comprehensive error handling
- ✅ Immutable state management
- ✅ Full test coverage (unit, integration, e2e)
- ✅ Functional, composable architecture
- ✅ Observability (metrics, traces, logs)

---

## Phase 1: Foundation

### 1.1 Upgrade TypeScript & Build Tooling

**Current:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true
  }
}
```

**Target:**
```json
{
  "compilerOptions": {
    // Modern target
    "target": "ES2022",
    "lib": ["ES2022"],

    // Strictest settings
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Path mapping for clean imports
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@core/*": ["core/*"],
      "@agents/*": ["agents/*"],
      "@tools/*": ["tools/*"],
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"]
    },

    // Modern resolution
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // NO DECORATORS - using Zod for validation instead
    // Decorators are experimental and not recommended

    // Source maps for debugging
    "sourceMap": true,
    "declarationMap": true,
    "declaration": true
  }
}
```

### 1.2 Add Modern Tooling

```bash
# Type checking
npm install --save-dev tsx

# Linting
npm install --save-dev @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-import

# Formatting
npm install --save-dev prettier \
  eslint-config-prettier \
  eslint-plugin-prettier

# Testing
npm install --save-dev vitest \
  @vitest/ui \
  @vitest/coverage-v8 \
  @testdouble/testdouble

# Type guards & validation (NO DECORATORS - using Zod)
npm install zod

# Observability
npm install --save-dev @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node

# Build tooling
npm install --save-dev tsup
```

### 1.3 New Directory Structure

```
src/
├── core/                    # Core abstractions
│   ├── types/               # Shared type definitions
│   │   ├── agent.ts         # Agent types
│   │   ├── actions.ts       # Action types (discriminated unions)
│   │   ├── state.ts         # State types
│   │   ├── errors.ts        # Error types
│   │   └── schemas.ts       # Zod validation schemas (NO DECORATORS)
│   ├── interfaces/          # Protocol definitions
│   │   ├── agent.ts         # IAgent interface
│   │   ├── tools.ts         # ITool interface
│   │   └── llm.ts           # ILLMProvider interface
│   └── base/                # Base classes
│       ├── Agent.ts         # Abstract Agent
│       ├── Tool.ts          # Abstract Tool
│       └── StateMachine.ts  # State machine base
├── agents/                  # Agent implementations
│   ├── ResearchAgent.ts     # Main research agent
│   └── EvaluatorAgent.ts    # Answer evaluator
├── tools/                   # Tool implementations
│   ├── SearchTool.ts
│   ├── VisitTool.ts
│   ├── ReflectTool.ts
│   └── index.ts             # Tool registry
├── services/                # Business logic
│   ├── SearchService.ts
│   ├── LLMService.ts
│   ├── EvaluationService.ts
│   └── StateManager.ts
├── utils/                   # Pure utilities
│   ├── retry.ts
│   ├── timeout.ts
│   ├── guards.ts            # Type guards
│   ├── predicates.ts        # Type predicates
│   └── brand.ts             # Branded types
├── middleware/              # Pipeline processing
│   ├── telemetry.ts
│   ├── logging.ts
│   └── error-handling.ts
├── config/                  # Configuration (using Zod, NO DECORATORS)
│   ├── models.ts
│   ├── providers.ts
│   ├── validation.ts        # Zod schemas
│   └── index.ts
├── cli.ts                   # CLI entry point
├── api.ts                   # API entry point
└── index.ts                 # Main export
```

---

## Phase 2: Core Loop Refactor

### 2.1 Finite State Machine

**Current Problem:** Infinite while loop with unclear exit conditions

**Solution:** Explicit finite state machine with guaranteed termination

```typescript
// src/core/types/agent.ts

import { z } from 'zod';

/**
 * Discriminated union for all possible agent states
 * This ensures exhaustive handling at compile time
 */
export type AgentState =
  | { status: 'idle' }
  | { status: 'initializing'; context: InitializationContext }
  | { status: 'searching'; step: number; query: string }
  | { status: 'reading'; step: number; url: string }
  | { status: 'evaluating'; step: number; answer: Answer }
  | { status: 'reflecting'; step: number; context: string }
  | { status: 'completed'; result: ResearchResult }
  | { status: 'failed'; error: AgentError }
  | { status: 'cancelled'; reason: string };

/**
 * Type guard for state checking
 */
export function isTerminal(state: AgentState): state is Extract<AgentState, { status: 'completed' | 'failed' | 'cancelled' }> {
  return state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled';
}

/**
 * Configuration with validation using Zod
 */
export const AgentConfigSchema = z.object({
  tokenBudget: z.number().int().positive().max(10_000_000),
  maxSteps: z.number().int().positive().max(1000).default(100),
  maxDuration: z.number().int().positive().max(3_600_000).default(300_000), // 5 minutes
  maxBadAttempts: z.number().int().nonnegative().max(10).default(3),
  timeout: z.number().int().positive().max(60_000).default(30_000),
  enableTelemetry: z.boolean().default(false),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Execution result with guaranteed termination
 */
export interface ResearchResult {
  state: Extract<AgentState, { status: 'completed' }>;
  answer: string;
  references: Reference[];
  metrics: ExecutionMetrics;
  timeline: ExecutionTimeline;
}

export interface ExecutionMetrics {
  totalSteps: number;
  totalTokens: number;
  totalDuration: number;
  actionCounts: Record<string, number>;
  errorCounts: Record<string, number>;
}

export interface ExecutionTimeline {
  started: Date;
  completed: Date;
  steps: Array<{
    step: number;
    action: string;
    timestamp: Date;
    duration: number;
  }>;
}
```

### 2.2 State Machine Implementation

```typescript
// src/core/base/StateMachine.ts

import { AgentState, AgentConfig, ResearchResult } from '../types/agent.js';
import { CancellationToken } from '../utils/timeout.js';

/**
 * Generic state machine with type-safe transitions
 */
export class StateMachine<TState, TConfig> {
  private currentState: TState;
  private config: TConfig;
  private history: Array<{ state: TState; timestamp: Date }> = [];
  private cancellationToken: CancellationToken;

  constructor(
    initialState: TState,
    config: TConfig,
    private readonly transitionHandlers: Map<
      string,
      (state: TState, config: TConfig) => Promise<TState> | TState
    >,
    private readonly validators: Map<string, (state: TState) => boolean>
  ) {
    this.currentState = initialState;
    this.config = config;
    this.cancellationToken = new CancellationToken(config.timeout || 30000);
  }

  /**
   * Execute state machine until terminal state
   * Guaranteed to terminate due to:
   * 1. Max steps limit
   * 2. Timeout enforcement
   * 3. Token budget tracking
   * 4. Explicit terminal states
   */
  async run(): Promise<TState> {
    const startTime = Date.now();
    let steps = 0;
    const maxSteps = (this.config as any).maxSteps || 100;
    const maxDuration = (this.config as any).maxDuration || 300000;

    while (!this.isTerminal(this.currentState)) {
      // Check termination conditions
      if (steps >= maxSteps) {
        throw new Error(`Max steps (${maxSteps}) exceeded`);
      }

      if (Date.now() - startTime > maxDuration) {
        throw new Error(`Max duration (${maxDuration}ms) exceeded`);
      }

      if (this.cancellationToken.isCancelled) {
        throw new Error('Operation cancelled');
      }

      // Get transition handler for current state
      const status = (this.currentState as any).status;
      const handler = this.transitionHandlers.get(status);

      if (!handler) {
        throw new Error(`No handler for state: ${status}`);
      }

      // Validate current state
      const validator = this.validators.get(status);
      if (validator && !validator(this.currentState)) {
        throw new Error(`Invalid state: ${status}`);
      }

      // Execute transition
      const nextState = await handler(this.currentState, this.config);

      // Record transition
      this.history.push({
        state: this.currentState,
        timestamp: new Date(),
      });

      this.currentState = nextState;
      steps++;
    }

    return this.currentState;
  }

  /**
   * Type guard for terminal states
   */
  private isTerminal(state: TState): boolean {
    const status = (state as any).status;
    return ['completed', 'failed', 'cancelled'].includes(status);
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<TState> {
    return Object.freeze({ ...this.currentState });
  }

  /**
   * Get execution history
   */
  getHistory(): ReadonlyArray<{ state: TState; timestamp: Date }> {
    return Object.freeze([...this.history]);
  }

  /**
   * Cancel execution
   */
  cancel(reason: string): void {
    this.cancellationToken.cancel(reason);
  }
}
```

### 2.3 Research Agent with State Machine

```typescript
// src/agents/ResearchAgent.ts

import { StateMachine } from '../core/base/StateMachine.js';
import { AgentState, AgentConfig, ResearchResult } from '../core/types/agent.js';
import { SearchService } from '../services/SearchService.js';
import { LLMService } from '../services/LLMService.js';
import { EvaluationService } from '../services/EvaluationService.js';
import { StateManager } from '../services/StateManager.js';
import { logger } from '../utils/logging.js';

export class ResearchAgent {
  private stateMachine: StateMachine<AgentState, AgentConfig>;
  private stateManager: StateManager;

  constructor(
    private readonly searchService: SearchService,
    private readonly llmService: LLMService,
    private readonly evaluationService: EvaluationService,
    config: AgentConfig
  ) {
    this.stateManager = new StateManager(config);

    // Initialize state machine with handlers
    this.stateMachine = new StateMachine<AgentState, AgentConfig>(
      { status: 'idle' },
      config,
      new Map([
        ['idle', this.handleIdle.bind(this)],
        ['initializing', this.handleInitializing.bind(this)],
        ['searching', this.handleSearching.bind(this)],
        ['reading', this.handleReading.bind(this)],
        ['evaluating', this.handleEvaluating.bind(this)],
        ['reflecting', this.handleReflecting.bind(this)],
      ]),
      new Map([
        ['idle', (s) => s.status === 'idle'],
        ['initializing', (s) => s.status === 'initializing'],
        ['searching', (s) => s.status === 'searching'],
        ['reading', (s) => s.status === 'reading'],
        ['evaluating', (s) => s.status === 'evaluating'],
        ['reflecting', (s) => s.status === 'reflecting'],
        ['completed', (s) => s.status === 'completed'],
        ['failed', (s) => s.status === 'failed'],
        ['cancelled', (s) => s.status === 'cancelled'],
      ])
    );
  }

  /**
   * Main execution method - guaranteed to terminate
   */
  async execute(query: string): Promise<ResearchResult> {
    logger.info('Starting research', { query });

    try {
      // Initialize state machine
      const initialState: AgentState = {
        status: 'initializing',
        context: {
          query,
          startTime: new Date(),
          step: 0,
          budget: this.stateManager.getConfig().tokenBudget,
        },
      };

      this.stateMachine = new StateMachine(
        initialState,
        this.stateManager.getConfig(),
        this.getTransitionHandlers(),
        this.getValidators()
      );

      // Run until terminal state
      const finalState = await this.stateMachine.run();

      // Validate terminal state
      if (finalState.status !== 'completed') {
        throw new Error(`Unexpected terminal state: ${finalState.status}`);
      }

      // Build result
      const result: ResearchResult = {
        state: finalState,
        answer: finalState.answer,
        references: finalState.references,
        metrics: this.stateManager.getMetrics(),
        timeline: this.stateManager.getTimeline(),
      };

      logger.info('Research completed', {
        steps: result.metrics.totalSteps,
        tokens: result.metrics.totalTokens,
        duration: result.metrics.totalDuration,
      });

      return result;

    } catch (error) {
      logger.error('Research failed', { error });

      // Return failed result
      return {
        state: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
        answer: '',
        references: [],
        metrics: this.stateManager.getMetrics(),
        timeline: this.stateManager.getTimeline(),
      };
    }
  }

  /**
   * Get state transition handlers
   */
  private getTransitionHandlers(): Map<string, (state: AgentState, config: AgentConfig) => Promise<AgentState>> {
    return new Map([
      ['idle', async () => ({ status: 'initializing', context: {} })],
      ['initializing', this.handleInitializing.bind(this)],
      ['searching', this.handleSearching.bind(this)],
      ['reading', this.handleReading.bind(this)],
      ['evaluating', this.handleEvaluating.bind(this)],
      ['reflecting', this.handleReflecting.bind(this)],
    ]);
  }

  /**
   * Get state validators
   */
  private getValidators(): Map<string, (state: AgentState) => boolean> {
    return new Map([
      ['initializing', (s) => s.status === 'initializing' && !!s.context],
      ['searching', (s) => s.status === 'searching' && s.step > 0],
      ['reading', (s) => s.status === 'reading' && !!s.url],
      ['evaluating', (s) => s.status === 'evaluating' && !!s.answer],
    ]);
  }

  /**
   * Handle initialization state
   */
  private async handleInitializing(
    state: Extract<AgentState, { status: 'initializing' }>,
    config: AgentConfig
  ): Promise<AgentState> {
    // Evaluate question
    const evaluation = await this.evaluationService.evaluateQuestion(state.context.query);

    // Determine next action based on evaluation
    if (evaluation.isTrivial) {
      return {
        status: 'completed',
        answer: await this.llmService.answer(state.context.query),
        references: [],
      };
    }

    // Start searching
    return {
      status: 'searching',
      step: 1,
      query: state.context.query,
    };
  }

  /**
   * Handle searching state
   */
  private async handleSearching(
    state: Extract<AgentState, { status: 'searching' }>,
    config: AgentConfig
  ): Promise<AgentState> {
    const { query, step } = state;

    // Check token budget
    const usedTokens = this.stateManager.getUsedTokens();
    if (usedTokens > config.tokenBudget * 0.85) {
      // Time to wrap up
      const answer = await this.stateManager.synthesizeAnswer();
      return {
        status: 'completed',
        answer,
        references: this.stateManager.getReferences(),
      };
    }

    // Perform search
    const results = await this.searchService.search(query);
    this.stateManager.addSearchResults(results);

    // Decide next action
    const action = await this.llmService.decideNextAction({
      query,
      step,
      results,
      context: this.stateManager.getContext(),
    });

    return this.transitionFromAction(action, step);
  }

  /**
   * Handle reading state
   */
  private async handleReading(
    state: Extract<AgentState, { status: 'reading' }>,
    config: AgentConfig
  ): Promise<AgentState> {
    const { url, step } = state;

    // Read URL
    const content = await this.searchService.readURL(url);
    this.stateManager.addContent(url, content);

    // Decide next action
    const action = await this.llmService.decideNextAction({
      step,
      context: this.stateManager.getContext(),
    });

    return this.transitionFromAction(action, step);
  }

  /**
   * Handle evaluating state
   */
  private async handleEvaluating(
    state: Extract<AgentState, { status: 'evaluating' }>,
    config: AgentConfig
  ): Promise<AgentState> {
    const { answer, step } = state;

    // Evaluate answer
    const evaluation = await this.evaluationService.evaluateAnswer(
      this.stateManager.getQuery(),
      answer
    );

    if (evaluation.passed || step >= config.maxSteps) {
      return {
        status: 'completed',
        answer,
        references: this.stateManager.getReferences(),
      };
    }

    // Failed evaluation - reflect
    return {
      status: 'reflecting',
      step: step + 1,
      context: evaluation.feedback,
    };
  }

  /**
   * Handle reflecting state
   */
  private async handleReflecting(
    state: Extract<AgentState, { status: 'reflecting' }>,
    config: AgentConfig
  ): Promise<AgentState> {
    const { step, context } = state;

    // Update context with feedback
    this.stateManager.addFeedback(context);

    // Decide next action (search, read, or try answering again)
    const action = await this.llmService.decideNextAction({
      step: step + 1,
      context: this.stateManager.getContext(),
    });

    return this.transitionFromAction(action, step + 1);
  }

  /**
   * Transition from LLM action to state
   */
  private transitionFromAction(
    action: { type: 'search' | 'read' | 'answer' | 'reflect'; data: any },
    step: number
  ): AgentState {
    switch (action.type) {
      case 'search':
        return {
          status: 'searching',
          step: step + 1,
          query: action.data.query,
        };
      case 'read':
        return {
          status: 'reading',
          step: step + 1,
          url: action.data.url,
        };
      case 'answer':
        return {
          status: 'evaluating',
          step: step + 1,
          answer: action.data.answer,
        };
      case 'reflect':
        return {
          status: 'reflecting',
          step: step + 1,
          context: action.data.context,
        };
      default:
        const exhaustiveCheck: never = action;
        throw new Error(`Unknown action type: ${exhaustiveCheck}`);
    }
  }

  /**
   * Cancel execution
   */
  cancel(reason: string): void {
    this.stateMachine.cancel(reason);
  }
}
```

---

## Phase 3: Type Safety

### 3.1 Discriminated Unions for Actions

```typescript
// src/core/types/actions.ts

/**
 * Base action type with discriminator
 */
export interface BaseAction {
  id: string;
  timestamp: Date;
  think: string;
}

/**
 * Search action - search for information
 */
export interface SearchAction extends BaseAction {
  type: 'search';
  queries: Array<{
    query: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Visit action - read specific URLs
 */
export interface VisitAction extends BaseAction {
  type: 'visit';
  urls: Array<{
    url: string;
    reason: string;
  }>;
}

/**
 * Answer action - provide final answer
 */
export interface AnswerAction extends BaseAction {
  type: 'answer';
  answer: string;
  confidence: number;
  references: Array<{
    url: string;
    quote: string;
  }>;
}

/**
 * Reflect action - analyze progress
 */
export interface ReflectAction extends BaseAction {
  type: 'reflect';
  analysis: {
    currentGaps: string[];
    progress: string;
    nextSteps: string[];
  };
}

/**
 * Coding action - execute code
 */
export interface CodingAction extends BaseAction {
  type: 'coding';
  code: string;
  language: string;
  expectedOutput?: string;
}

/**
 * Union type of all actions
 * Using discriminated union for type safety
 */
export type AgentAction =
  | SearchAction
  | VisitAction
  | AnswerAction
  | ReflectAction
  | CodingAction;

/**
 * Type guard for search action
 */
export function isSearchAction(action: AgentAction): action is SearchAction {
  return action.type === 'search';
}

/**
 * Type guard for answer action
 */
export function isAnswerAction(action: AgentAction): action is AnswerAction {
  return action.type === 'answer';
}

/**
 * Execute action with type-safe handling
 */
export async function executeAction(
  action: AgentAction,
  executor: ActionExecutor
): Promise<ActionResult> {
  switch (action.type) {
    case 'search':
      return executor.executeSearch(action);
    case 'visit':
      return executor.executeVisit(action);
    case 'answer':
      return executor.executeAnswer(action);
    case 'reflect':
      return executor.executeReflect(action);
    case 'coding':
      return executor.executeCoding(action);
    default:
      // TypeScript ensures exhaustive handling
      const exhaustiveCheck: never = action;
      throw new Error(`Unknown action type: ${exhaustiveCheck}`);
  }
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  executeSearch(action: SearchAction): Promise<ActionResult>;
  executeVisit(action: VisitAction): Promise<ActionResult>;
  executeAnswer(action: AnswerAction): Promise<ActionResult>;
  executeReflect(action: ReflectAction): Promise<ActionResult>;
  executeCoding(action: CodingAction): Promise<ActionResult>;
}

/**
 * Action result
 */
export type ActionResult =
  | { success: true; data: unknown }
  | { success: false; error: Error };
```

### 3.2 Strict Configuration Types

```typescript
// src/config/models.ts

import { z } from 'zod';

/**
 * LLM provider configuration
 */
export const LLMProviderConfigSchema = z.object({
  name: z.enum(['openai', 'gemini', 'anthropic']),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  timeout: z.number().int().positive().default(30000),
});

export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;

/**
 * Search provider configuration
 */
export const SearchProviderConfigSchema = z.object({
  name: z.enum(['jina', 'brave', 'serper']),
  apiKey: z.string().min(1),
  maxResults: z.number().int().positive().max(100).default(10),
  timeout: z.number().int().positive().default(10000),
});

export type SearchProviderConfig = z.infer<typeof SearchProviderConfigSchema>;

/**
 * Tool configuration
 */
export const ToolConfigSchema = z.object({
  coder: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),

  evaluator: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }).optional(),

  agent: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * Complete application configuration
 */
export const AppConfigSchema = z.object({
  llm: LLMProviderConfigSchema,
  search: SearchProviderConfigSchema,
  tools: ToolConfigSchema.optional(),

  // Research limits
  limits: z.object({
    maxSteps: z.number().int().positive().max(1000),
    maxDuration: z.number().int().positive().max(3600000),
    maxBadAttempts: z.number().int().nonnegative().max(10),
    tokenBudget: z.number().int().positive().max(10000000),
  }),

  // Feature flags
  features: z.object({
    enableTelemetry: z.boolean().default(false),
    enableCaching: z.boolean().default(true),
    enableTracing: z.boolean().default(false),
  }),

  // Observability
  observability: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']),
    metricsEnabled: z.boolean().default(false),
    tracingEnabled: z.boolean().default(false),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Validate and parse configuration
 */
export function validateConfig(config: unknown): AppConfig {
  return AppConfigSchema.parse(config);
}

/**
 * Load configuration from environment
 */
export function loadConfigFromEnv(): AppConfig {
  return AppConfigSchema.parse({
    llm: {
      name: process.env.LLM_PROVIDER as 'openai' | 'gemini' | 'anthropic',
      apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.DEFAULT_MODEL_NAME,
    },
    search: {
      name: (process.env.SEARCH_PROVIDER || 'jina') as 'jina' | 'brave' | 'serper',
      apiKey: process.env.JINA_API_KEY || process.env.BRAVE_API_KEY || process.env.SERPER_API_KEY,
    },
    limits: {
      maxSteps: parseInt(process.env.MAX_STEPS || '100'),
      maxDuration: parseInt(process.env.MAX_DURATION || '300000'),
      maxBadAttempts: parseInt(process.env.MAX_BAD_ATTEMPTS || '3'),
      tokenBudget: parseInt(process.env.TOKEN_BUDGET || '2000000'),
    },
    observability: {
      logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    },
  });
}
```

---

## Phase 4: State Management

### 4.1 Immutable State Manager

```typescript
// src/services/StateManager.ts

import { produce, enablePatches } from 'immer';
import { z } from 'zod';

enablePatches();

/**
 * Research state schema
 */
const ResearchStateSchema = z.object({
  query: z.string(),
  step: z.number().int().nonnegative(),
  startTime: z.date(),
  lastUpdate: z.date(),
  budget: z.object({
    total: z.number().int().positive(),
    used: z.number().int().nonnegative(),
  }),
  knowledge: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    type: z.enum(['qa', 'search', 'visit']),
    timestamp: z.date(),
  })),
  urls: z.record(z.object({
    url: z.string().url(),
    title: z.string(),
    snippet: z.string(),
    relevance: z.number().min(0).max(1),
    visited: z.boolean(),
  })),
  content: z.record(z.object({
    url: z.string().url(),
    content: z.string(),
    timestamp: z.date(),
  })),
  metrics: z.object({
    searchCount: z.number().int().nonnegative(),
    visitCount: z.number().int().nonnegative(),
    evaluationCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
  }),
});

export type ResearchState = z.infer<typeof ResearchStateSchema>;

/**
 * Immutable state manager using Immer
 */
export class StateManager {
  private state: ResearchState;
  private listeners: Set<(state: ResearchState) => void> = new Set();
  private patchHistory: Array<{
    patches: unknown[];
    inversePatches: unknown[];
    timestamp: Date;
  }> = [];

  constructor(private readonly config: { tokenBudget: number }) {
    this.state = {
      query: '',
      step: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      budget: {
        total: config.tokenBudget,
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
    return Object.freeze({ ...this.state });
  }

  /**
   * Update state with Immer for immutability
   */
  update(updater: (draft: ResearchState) => void): void {
    const { patches, inversePatches } = produce(
      this.state,
      updater,
      (patches, inversePatches) => {
        // Store patches for undo/redo
        this.patchHistory.push({
          patches,
          inversePatches,
          timestamp: new Date(),
        });

        // Keep only last 100 patch sets
        if (this.patchHistory.length > 100) {
          this.patchHistory.shift();
        }
      }
    );

    this.state.lastUpdate = new Date();
    this.notifyListeners();
  }

  /**
   * Add search results to state
   */
  addSearchResults(results: Array<{ url: string; title: string; snippet: string }>): void {
    this.update((draft) => {
      results.forEach((result) => {
        if (!draft.urls[result.url]) {
          draft.urls[result.url] = {
            ...result,
            relevance: 0.5,
            visited: false,
          };
        }
      });
      draft.metrics.searchCount++;
    });
  }

  /**
   * Add content from visited URL
   */
  addContent(url: string, content: string): void {
    this.update((draft) => {
      if (draft.urls[url]) {
        draft.urls[url].visited = true;
      }
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
      draft.knowledge.push({
        question,
        answer,
        type,
        timestamp: new Date(),
      });
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
   * Check if budget exhausted
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
  getMetrics() {
    return {
      totalSteps: this.state.step,
      totalTokens: this.state.budget.used,
      totalDuration: Date.now() - this.state.startTime.getTime(),
      ...this.state.metrics,
    };
  }

  /**
   * Get references
   */
  getReferences(): Array<{ url: string; quote: string }> {
    return Object.values(this.state.content)
      .slice(0, 10)
      .map((c) => ({
        url: c.url,
        quote: c.content.slice(0, 200) + '...',
      }));
  }

  /**
   * Synthesize answer from state
   */
  async synthesizeAnswer(): Promise<string> {
    // Collect relevant content
    const relevantContent = Object.values(this.state.content)
      .filter((c) => this.state.urls[c.url]?.relevance > 0.7)
      .map((c) => c.content)
      .join('\n\n');

    return `Based on the research:\n\n${relevantContent}`;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ResearchState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
  getPatchHistory() {
    return Object.freeze([...this.patchHistory]);
  }

  /**
   * Undo last state change
   */
  undo(): void {
    const lastPatch = this.patchHistory.pop();
    if (!lastPatch) return;

    this.state = produce(
      this.state,
      (draft) => {
        // Apply inverse patches
        return lastPatch.inversePatches;
      }
    );

    this.notifyListeners();
  }

  /**
   * Export state as JSON
   */
  export(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from JSON
   */
  import(json: string): void {
    const parsed = JSON.parse(json);
    const validated = ResearchStateSchema.parse(parsed);
    this.state = validated;
    this.notifyListeners();
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get context for LLM
   */
  getContext() {
    return {
      query: this.state.query,
      step: this.state.step,
      knowledge: this.state.knowledge.slice(-10),
      urls: Object.entries(this.state.urls)
        .filter(([_, u]) => u.visited)
        .slice(0, 10),
    };
  }

  /**
   * Get timeline
   */
  getTimeline() {
    return {
      started: this.state.startTime,
      completed: this.state.lastUpdate,
      steps: this.patchHistory.map((p, i) => ({
        step: i + 1,
        action: 'state_update',
        timestamp: p.timestamp,
        duration: 0, // Calculate from patches
      })),
    };
  }
}
```

---

## Phase 5: Error Handling

### 5.1 Error Type Hierarchy

```typescript
// src/core/types/errors.ts

/**
 * Base error class with error code
 */
export abstract class AgentError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      context: this.context,
    };
  }
}

/**
 * Configuration errors (not retryable)
 */
export class ConfigurationError extends AgentError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly retryable = false;
}

/**
 * Validation errors (not retryable)
 */
export class ValidationError extends AgentError {
  readonly code = 'VALIDATION_ERROR';
  readonly retryable = false;
}

/**
 * LLM errors (may be retryable)
 */
export class LLMError extends AgentError {
  readonly code = 'LLM_ERROR';
  readonly retryable: boolean;

  constructor(
    message: string,
    context: Record<string, unknown> & { provider: string; statusCode?: number }
  ) {
    super(message, context);
    // Retry on rate limits (429) and server errors (5xx)
    this.retryable = !context.statusCode || context.statusCode >= 429 || context.statusCode >= 500;
  }
}

/**
 * Search errors (may be retryable)
 */
export class SearchError extends AgentError {
  readonly code = 'SEARCH_ERROR';
  readonly retryable: boolean;

  constructor(
    message: string,
    context: Record<string, unknown> & { provider: string; statusCode?: number }
  ) {
    super(message, context);
    this.retryable = !context.statusCode || context.statusCode >= 500;
  }
}

/**
 * Timeout errors (not retryable)
 */
export class TimeoutError extends AgentError {
  readonly code = 'TIMEOUT_ERROR';
  readonly retryable = false;

  constructor(
    message: string,
    context: Record<string, unknown> & { timeout: number; duration: number }
  ) {
    super(message, context);
  }
}

/**
 * Token budget exceeded (not retryable)
 */
export class BudgetExceededError extends AgentError {
  readonly code = 'BUDGET_EXCEEDED';
  readonly retryable = false;

  constructor(
    message: string,
    context: Record<string, unknown> & { budget: number; used: number }
  ) {
    super(message, context);
  }
}

/**
 * Max steps exceeded (not retryable)
 */
export class MaxStepsError extends AgentError {
  readonly code = 'MAX_STEPS_EXCEEDED';
  readonly retryable = false;

  constructor(
    message: string,
    context: Record<string, unknown> & { maxSteps: number; actualSteps: number }
  ) {
    super(message, context);
  }
}

/**
 * Error type guard
 */
export function isRetryable(error: AgentError): boolean {
  return error.retryable;
}

/**
 * Get error from unknown
 */
export function getAgentError(error: unknown): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    return new LLMError(error.message, { provider: 'unknown', originalError: error });
  }

  return new LLMError(String(error), { provider: 'unknown' });
}
```

### 5.2 Error Boundary Pattern

```typescript
// src/utils/error-handling.ts

import { AgentError, getAgentError, isRetryable } from '../core/types/errors.js';
import { logger } from './logging.js';

/**
 * Error boundary options
 */
export interface ErrorBoundaryOptions {
  maxRetries: number;
  retryDelay: number;
  onRetry?: (error: AgentError, attempt: number) => void;
  onError?: (error: AgentError) => void;
  onSuccess?: () => void;
}

/**
 * Execute with error boundary and retry logic
 */
export async function withErrorBoundary<T>(
  fn: () => Promise<T>,
  options: ErrorBoundaryOptions = { maxRetries: 3, retryDelay: 1000 }
): Promise<T> {
  let lastError: AgentError | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await fn();
      options.onSuccess?.();
      return result;
    } catch (error) {
      lastError = getAgentError(error);

      logger.error('Operation failed', {
        error: lastError.toJSON(),
        attempt: attempt + 1,
        maxRetries: options.maxRetries + 1,
      });

      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryable(lastError) || attempt >= options.maxRetries) {
        options.onError?.(lastError);
        throw lastError;
      }

      // Notify retry
      options.onRetry?.(lastError, attempt + 1);

      // Wait before retrying
      await sleep(options.retryDelay * (attempt + 1)); // Exponential backoff
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime.getTime() > this.timeout
      ) {
        // Try to close circuit
        this.state = 'half-open';
        logger.info('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is OPEN - call skipped');
      }
    }

    try {
      const result = await fn();

      // Success - reset or close circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info('Circuit breaker closed after successful request');
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();

      if (this.failureCount >= this.threshold) {
        this.state = 'open';
        logger.error('Circuit breaker opened after threshold failures', {
          failures: this.failureCount,
          threshold: this.threshold,
        });
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    logger.info('Circuit breaker manually reset');
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## Phase 6: Testing

### 6.1 Test Infrastructure

```typescript
// test/utils/test-helpers.ts

import { AgentConfig } from '../src/core/types/agent.js';
import { ResearchAgent } from '../src/agents/ResearchAgent.js';
import { MockSearchService } from './mocks/MockSearchService.js';
import { MockLLMService } from './mocks/MockLLMService.js';
import { MockEvaluationService } from './mocks/MockEvaluationService.js';

/**
 * Create test agent with mock services
 */
export function createTestAgent(config?: Partial<AgentConfig>) {
  const defaultConfig: AgentConfig = {
    tokenBudget: 10000,
    maxSteps: 10,
    maxDuration: 60000,
    maxBadAttempts: 2,
    timeout: 5000,
    enableTelemetry: false,
  };

  const mockSearch = new MockSearchService();
  const mockLLM = new MockLLMService();
  const mockEvaluation = new MockEvaluationService();

  const agent = new ResearchAgent(
    mockSearch,
    mockLLM,
    mockEvaluation,
    { ...defaultConfig, ...config }
  );

  return {
    agent,
    mockSearch,
    mockLLM,
    mockEvaluation,
  };
}

/**
 * Create test state
 */
export function createTestState(overrides = {}) {
  return {
    query: 'test query',
    step: 1,
    startTime: new Date(),
    lastUpdate: new Date(),
    budget: { total: 10000, used: 100 },
    knowledge: [],
    urls: {},
    content: {},
    metrics: {
      searchCount: 1,
      visitCount: 0,
      evaluationCount: 0,
      errorCount: 0,
    },
    ...overrides,
  };
}

/**
 * Wait for async condition
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await sleep(50);
  }
}

/**
 * Flush all promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}
```

### 6.2 Unit Tests

```typescript
// test/unit/StateMachine.test.ts

import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../src/core/base/StateMachine.js';
import { AgentState, AgentConfig } from '../src/core/types/agent.js';

describe('StateMachine', () => {
  it('should transition through states', async () => {
    const handlers = new Map<string, (state: AgentState, config: AgentConfig) => Promise<AgentState>>([
      ['idle', async () => ({ status: 'initializing', context: {} })],
      ['initializing', async () => ({ status: 'searching', step: 1, query: 'test' })],
      ['searching', async () => ({ status: 'completed', answer: 'done', references: [] })],
    ]);

    const machine = new StateMachine(
      { status: 'idle' },
      { tokenBudget: 1000, maxSteps: 10, maxDuration: 5000, maxBadAttempts: 2, timeout: 1000, enableTelemetry: false },
      handlers,
      new Map()
    );

    const result = await machine.run();

    expect(result.status).toBe('completed');
  });

  it('should enforce max steps limit', async () => {
    const handlers = new Map<string, (state: AgentState, config: AgentConfig) => Promise<AgentState>>([
      ['idle', async () => ({ status: 'searching', step: 1, query: 'test' })],
      ['searching', async (state) => ({ status: 'searching', step: state.step + 1, query: 'test' })],
    ]);

    const machine = new StateMachine(
      { status: 'idle' },
      { tokenBudget: 10000, maxSteps: 3, maxDuration: 5000, maxBadAttempts: 2, timeout: 1000, enableTelemetry: false },
      handlers,
      new Map()
    );

    await expect(machine.run()).rejects.toThrow('Max steps (3) exceeded');
  });

  it('should enforce timeout', async () => {
    const handlers = new Map<string, (state: AgentState, config: AgentConfig) => Promise<AgentState>>([
      ['idle', async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { status: 'searching', step: 1, query: 'test' };
      }],
    ]);

    const machine = new StateMachine(
      { status: 'idle' },
      { tokenBudget: 10000, maxSteps: 10, maxDuration: 1000, maxBadAttempts: 2, timeout: 500, enableTelemetry: false },
      handlers,
      new Map()
    );

    await expect(machine.run()).rejects.toThrow('Max duration');
  });
});
```

---

## Phase 7: Observability

### 7.1 Structured Logging

```typescript
// src/utils/logging.ts

import { pino } from 'pino';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured logger
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create child logger with context
 */
export function createLogger(context: string) {
  return logger.child({ component: context });
}

/**
 * Log execution metrics
 */
export function logMetrics(metrics: {
  operation: string;
  duration: number;
  tokens?: number;
  success: boolean;
  error?: string;
}) {
  logger.info({
    type: 'metric',
    ...metrics,
  });
}
```

### 7.2 Telemetry

```typescript
// src/middleware/telemetry.ts

import { trace } from '@opentelemetry/api';
import { logger } from '../utils/logging.js';

/**
 * Wrap function with telemetry
 */
export function withTelemetry<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const tracer = trace.getTracer('deepresearch');
    const span = tracer.startSpan(name);

    try {
      const result = await fn(...args);
      span.setStatus({ code: 1 });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: String(error) });
      span.end();
      throw error;
    }
  }) as T;
}

/**
 * Measure execution time
 */
export function measure<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  return fn().finally(() => {
    const duration = Date.now() - start;
    logger.info({ metric: 'duration', name, duration });
  });
}
```

---

## Modern TypeScript Features

### 1. Template Literal Types

```typescript
// Event names from string literals
type EventName = `search:${string}` | `visit:${string}` | `answer:${string}`;

function emitEvent<T extends EventName>(event: T, data: any): void {
  console.log(event, data);
}

emitEvent('search:jina ai', { query: 'jina ai' }); // ✅ OK
emitEvent('invalid', {}); // ❌ Compile error
```

### 2. Branded Types

```typescript
// Type-safe IDs
type USD = number & { readonly __brand: unique symbol };
type EUR = number & { readonly __brand: unique symbol };

function usd(amount: number): USD {
  return amount as USD;
}

function eur(amount: number): EUR {
  return amount as EUR;
}

function addUSD(a: USD, b: USD): USD {
  return usd((a as number) + (b as number));
}

const price = usd(100);
const tax = usd(20);

addUSD(price, tax); // ✅ OK
// addUSD(price, eur(80)); // ❌ Compile error
```

### 3. Utility Types

```typescript
// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// Deep partial
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

// Deep required
type DeepRequired<T> = {
  [P in keyof T]-?: DeepRequired<T[P]>;
};
```

### 4. Assertion Functions

```typescript
// Assertion function for type narrowing
function assertDefined<T>(value: T | null | undefined): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error('Value is not defined');
  }
}

function assertAgentState(state: AgentState): asserts state is Extract<AgentState, { status: 'completed' }> {
  if (state.status !== 'completed') {
    throw new Error(`Expected completed state, got: ${state.status}`);
  }
}

// Usage
const result = getResult();
assertDefined(result);
result.answer; // TypeScript knows this is defined

const state = getState();
assertAgentState(state);
state.answer; // TypeScript knows this exists
```

### 5. Satisfies Operator

```typescript
// More flexible than direct type annotation
const config = {
  tokenBudget: 1000000,
  maxSteps: 100,
} satisfies AgentConfig;

// Still allows inference
const budget = config.tokenBudget; // number, not 1000000 literal
```

### 6. Awaited Type

```typescript
// Unwrap promise type
type Result = Awaited<Promise<string>>; // string

type AsyncResult = Awaited<Promise<{
  data: string;
  error: Error;
}>>;
// { data: string; error: Error }
```

### 7. Conditional Types

```typescript
// Extract Promise value type
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>; // string
type B = UnwrapPromise<string>; // string
```

---

## Migration Strategy

### Step-by-Step Migration

**Week 1: Foundation**
- [ ] Upgrade to TypeScript 5.3+
- [ ] Update tsconfig.json
- [ ] Install new tooling (vitest, zod, immer)
- [ ] Create new directory structure
- [ ] Setup linting and formatting

**Week 2: Core Types**
- [ ] Define discriminated unions for actions
- [ ] Create error type hierarchy
- [ ] Build configuration schemas with Zod
- [ ] Write type guards

**Week 3: State Management**
- [ ] Implement StateManager with Immer
- [ ] Build state machine base class
- [ ] Add unit tests for state management

**Week 4: Core Loop**
- [ ] Refactor main loop to use state machine
- [ ] Add termination conditions
- [ ] Implement timeout handling
- [ ] Add comprehensive error handling

**Week 5: Services**
- [ ] Refactor LLM service
- [ ] Refactor search service
- [ ] Refactor evaluation service
- [ ] Add circuit breakers

**Week 6: Testing**
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests
- [ ] Add E2E tests
- [ ] Setup CI/CD

**Week 7: Observability**
- [ ] Add structured logging
- [ ] Implement metrics collection
- [ ] Add distributed tracing
- [ ] Build monitoring dashboard

**Week 8: Documentation & Polish**
- [ ] Update all documentation
- [ ] Add usage examples
- [ ] Performance optimization
- [ ] Security audit

---

## Success Metrics

### Quality Metrics
- ✅ 0 infinite loops
- ✅ 80%+ test coverage
- ✅ 0 TypeScript `any` types
- ✅ 0 ESLint warnings
- ✅ All state immutable

### Performance Metrics
- ✅ Max execution time: 5 minutes
- ✅ Max API calls per query: 100
- ✅ 99% queries complete successfully
- ✅ Average completion time: < 30 seconds

### Developer Experience
- ✅ Full type safety
- ✅ Excellent autocomplete
- ✅ Clear error messages
- ✅ Comprehensive documentation
- ✅ Easy to debug

---

## Conclusion

This refactoring plan transforms the codebase from a buggy, unsafe prototype into a production-ready, type-safe application. By leveraging modern TypeScript features and best practices, we ensure:

1. **Correctness**: Finite execution, no infinite loops
2. **Safety**: Type-safe at compile time, validated at runtime
3. **Maintainability**: Clear architecture, well-tested
4. **Observability**: Full visibility into execution
5. **Performance**: Efficient resource usage

The phased approach allows gradual migration without breaking existing functionality.
