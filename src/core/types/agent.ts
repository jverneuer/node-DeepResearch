/**
 * Core agent types using discriminated unions
 * Provides exhaustive type checking and type-safe state transitions
 */

import { z } from 'zod';

/**
 * Discriminated union for all possible agent states
 * TypeScript ensures all states are handled
 */
export type AgentState =
  | { readonly status: 'idle' }
  | { readonly status: 'initializing'; readonly context: InitializationContext }
  | { readonly status: 'searching'; readonly step: number; readonly query: string }
  | { readonly status: 'reading'; readonly step: number; readonly url: string }
  | { readonly status: 'evaluating'; readonly step: number; readonly answer: string }
  | { readonly status: 'reflecting'; readonly step: number; readonly feedback: string }
  | { readonly status: 'completed'; readonly answer: string; readonly references: ReadonlyArray<Reference> }
  | { readonly status: 'failed'; readonly error: string }
  | { readonly status: 'cancelled'; readonly reason: string };

/**
 * Initialization context
 */
export interface InitializationContext {
  readonly query: string;
  readonly startTime: Date;
}

/**
 * Reference to a source
 */
export interface Reference {
  readonly url: string;
  readonly quote: string;
  readonly relevance?: number;
}

/**
 * Terminal states - agent stops when in these states
 */
export type TerminalState = Extract<AgentState, { status: 'completed' | 'failed' | 'cancelled' }>;

/**
 * Non-terminal states - agent continues processing
 */
export type NonTerminalState = Exclude<AgentState, TerminalState>;

/**
 * Type guard: check if state is terminal
 */
export function isTerminal(state: AgentState): state is TerminalState {
  return (
    state.status === 'completed' ||
    state.status === 'failed' ||
    state.status === 'cancelled'
  );
}

/**
 * Type guard: check if state is non-terminal
 */
export function isNonTerminal(state: AgentState): state is NonTerminalState {
  return !isTerminal(state);
}

/**
 * Configuration schema using Zod for runtime validation
 */
export const AgentConfigSchema = z
  .object({
    tokenBudget: z.number().int().positive().max(10_000_000),
    maxSteps: z.number().int().positive().max(1000).default(100),
    maxDuration: z.number().int().positive().max(3_600_000).default(300_000), // 5 minutes
    maxBadAttempts: z.number().int().nonnegative().max(10).default(3),
    timeout: z.number().int().positive().max(60_000).default(30_000),
    enableTelemetry: z.boolean().default(false),
  })
  .strict();

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Execution result with guaranteed termination
 */
export interface ResearchResult {
  readonly query: string;
  readonly answer: string;
  readonly references: ReadonlyArray<Reference>;
  readonly metrics: ResearchMetrics;
  readonly duration: number;
  readonly steps: number;
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
 * Get state status as string literal
 */
export type StateStatus = AgentState['status'];

/**
 * Type guard for specific state status
 */
export function hasStatus<T extends StateStatus>(
  state: AgentState,
  status: T
): state is Extract<AgentState, { status: T }> {
  return state.status === status;
}

/**
 * Type guard: Idle state
 */
export function isIdle(state: AgentState): state is Extract<AgentState, { status: 'idle' }> {
  return state.status === 'idle';
}

/**
 * Type guard: Initializing state
 */
export function isInitializing(state: AgentState): state is Extract<AgentState, { status: 'initializing' }> {
  return state.status === 'initializing';
}

/**
 * Type guard: Searching state
 */
export function isSearching(state: AgentState): state is Extract<AgentState, { status: 'searching' }> {
  return state.status === 'searching';
}

/**
 * Type guard: Reading state
 */
export function isReading(state: AgentState): state is Extract<AgentState, { status: 'reading' }> {
  return state.status === 'reading';
}

/**
 * Type guard: Evaluating state
 */
export function isEvaluating(state: AgentState): state is Extract<AgentState, { status: 'evaluating' }> {
  return state.status === 'evaluating';
}

/**
 * Type guard: Reflecting state
 */
export function isReflecting(state: AgentState): state is Extract<AgentState, { status: 'reflecting' }> {
  return state.status === 'reflecting';
}
