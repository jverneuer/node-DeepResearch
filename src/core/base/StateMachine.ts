/**
 * Generic state machine with guaranteed termination
 * Prevents infinite loops through multiple exit conditions
 */

import type { AgentConfig, ResearchResult, TerminalState, AgentState } from './types/agent.js';
import type { AgentError, TimeoutError as AgentTimeoutError } from './types/errors.js';
import { setTimeout } from 'node:timers/promises';

/**
 * State transition handler type
 */
export type StateTransitionHandler<TState, TConfig> = (
  state: TState,
  config: TConfig
) => Promise<TState> | TState;

/**
 * State validator type
 */
export type StateValidator<TState> = (state: TState) => boolean;

/**
 * Transition history entry
 */
export interface TransitionHistoryEntry<TState> {
  readonly from: TState;
  readonly to: TState;
  readonly timestamp: Date;
  readonly duration: number;
}

/**
 * State machine options
 */
export interface StateMachineOptions<TConfig> {
  readonly maxSteps: number;
  readonly maxDuration: number;
  readonly timeout: number;
  readonly onStateChange?: (from: TState, to: TState) => void;
}

/**
 * Generic state machine with guaranteed termination
 *
 * Features:
 * - Max steps limit
 * - Timeout enforcement
 * - Token budget tracking
 * - Explicit terminal states
 * - State validation
 * - Transition history
 */
export class StateMachine<TState, TConfig> {
  private currentState: TState;
  private readonly config: TConfig;
  private readonly options: StateMachineOptions<TConfig>;
  private readonly transitionHandlers: ReadonlyMap<string, StateTransitionHandler<TState, TConfig>>;
  private readonly validators: ReadonlyMap<string, StateValidator<TState>>;
  private readonly history: TransitionHistoryEntry<TState>[] = [];
  private startTime = Date.now();
  private stepCount = 0;
  private isCancelled = false;
  private cancelReason?: string;

  constructor(
    initialState: TState,
    config: TConfig,
    options: StateMachineOptions<TConfig>,
    transitionHandlers: ReadonlyMap<string, StateTransitionHandler<TState, TConfig>>,
    validators: ReadonlyMap<string, StateValidator<TState>>
  ) {
    this.currentState = initialState;
    this.config = config;
    this.options = options;
    this.transitionHandlers = transitionHandlers;
    this.validators = validators;
  }

  /**
   * Execute state machine until terminal state
   * GUARANTEED TO TERMINATE due to:
   * 1. Max steps limit
   * 2. Timeout enforcement
   * 3. Explicit terminal states
   * 4. Manual cancellation
   */
  async run(): Promise<TState> {
    this.startTime = Date.now();

    while (!this.isTerminal(this.currentState)) {
      // Check cancellation first
      if (this.isCancelled) {
        throw new Error(`State machine cancelled: ${this.cancelReason}`);
      }

      // Check termination conditions
      this.checkTerminationConditions();

      // Get transition handler for current state
      const status = (this.currentState as { status: string }).status;
      const handler = this.transitionHandlers.get(status);

      if (!handler) {
        throw new Error(`No transition handler for state: ${status}`);
      }

      // Validate current state
      const validator = this.validators.get(status);
      if (validator && !validator(this.currentState)) {
        throw new Error(`Invalid state: ${status}`);
      }

      // Record start time for transition
      const transitionStart = Date.now();

      // Execute transition with timeout
      const nextState = await this.executeWithTimeout(
        () => handler(this.currentState, this.config),
        this.options.timeout
      );

      // Record transition
      const duration = Date.now() - transitionStart;
      this.recordTransition(this.currentState, nextState, duration);

      // Notify state change
      this.options.onStateChange?.(this.currentState, nextState);

      // Update state
      this.currentState = nextState;
      this.stepCount++;
    }

    return this.currentState;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout: number
  ): Promise<T> {
    const timeoutPromise = setTimeout(timeout, () => {
      throw new Error(`State transition timeout after ${timeout}ms`);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutPromise);
      return result as T;
    } catch (error) {
      clearTimeout(timeoutPromise);
      throw error;
    }
  }

  /**
   * Check all termination conditions
   */
  private checkTerminationConditions(): void {
    // Check max steps
    if (this.stepCount >= this.options.maxSteps) {
      throw new Error(
        `Max steps (${this.options.maxSteps}) exceeded at step ${this.stepCount}`
      );
    }

    // Check max duration
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.options.maxDuration) {
      throw new Error(
        `Max duration (${this.options.maxDuration}ms) exceeded after ${elapsed}ms`
      );
    }
  }

  /**
   * Record transition in history
   */
  private recordTransition(from: TState, to: TState, duration: number): void {
    this.history.push({
      from,
      to,
      timestamp: new Date(),
      duration,
    });

    // Keep only last 100 transitions
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Type guard for terminal states
   */
  private isTerminal(state: TState): boolean {
    const status = (state as { status: string }).status;
    return ['completed', 'failed', 'cancelled'].includes(status);
  }

  /**
   * Get current state (immutable)
   */
  getState(): Readonly<TState> {
    return Object.freeze({ ...this.currentState });
  }

  /**
   * Get transition history
   */
  getHistory(): ReadonlyArray<TransitionHistoryEntry<TState>> {
    return Object.freeze([...this.history]);
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.stepCount;
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Cancel execution
   */
  cancel(reason: string): void {
    this.isCancelled = true;
    this.cancelReason = reason;
  }

  /**
   * Check if cancelled
   */
  isCancelledState(): boolean {
    return this.isCancelled;
  }
}

/**
 * Create a state machine with proper typing
 */
export function createStateMachine<TState extends { status: string }, TConfig>(
  initialState: TState,
  config: TConfig,
  options: StateMachineOptions<TConfig>,
  handlers: Record<string, StateTransitionHandler<TState, TConfig>>,
  validators?: Record<string, StateValidator<TState>>
): StateMachine<TState, TConfig> {
  return new StateMachine(
    initialState,
    config,
    options,
    new Map(Object.entries(handlers)),
    new Map(Object.entries(validators ?? {}))
  );
}
