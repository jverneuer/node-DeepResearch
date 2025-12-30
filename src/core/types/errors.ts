/**
 * Error type hierarchy with strict type safety
 * No 'any' types, discriminated unions, proper error handling
 */

/**
 * Base error class with error code and context
 * All errors must extend this class
 */
export abstract class AgentError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    public readonly context: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): Record<string, unknown> {
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
 * Example: Invalid API key, missing required config
 */
export class ConfigurationError extends AgentError {
  readonly code = 'CONFIGURATION_ERROR' as const;
  readonly retryable = false as const;
}

/**
 * Validation errors (not retryable)
 * Example: Invalid input data, schema validation failure
 */
export class ValidationError extends AgentError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly retryable = false as const;
}

/**
 * LLM errors (may be retryable)
 * Example: Rate limit (429), server error (5xx)
 */
export class LLMError extends AgentError {
  readonly code = 'LLM_ERROR' as const;
  readonly retryable: boolean;

  constructor(
    message: string,
    context: Readonly<{
      provider: string;
      statusCode?: number;
      model?: string;
    }>
  ) {
    super(message, context);
    // Retry on rate limits (429) and server errors (5xx)
    this.retryable =
      !context.statusCode ||
      context.statusCode === 429 ||
      context.statusCode >= 500;
  }
}

/**
 * Search errors (may be retryable)
 * Example: Search API down, timeout
 */
export class SearchError extends AgentError {
  readonly code = 'SEARCH_ERROR' as const;
  readonly retryable: boolean;

  constructor(
    message: string,
    context: Readonly<{
      provider: string;
      statusCode?: number;
      query?: string;
    }>
  ) {
    super(message, context);
    // Retry on server errors (5xx)
    this.retryable = !context.statusCode || context.statusCode >= 500;
  }
}

/**
 * Content errors (potentially retryable)
 * Example: Failed to read web page content
 */
export class ContentError extends AgentError {
  readonly code = 'CONTENT_ERROR' as const;
  readonly retryable: boolean;

  constructor(
    message: string,
    url?: string,
    originalError?: Error
  ) {
    super(message, { url, originalError });
    // Retry on network errors
    this.retryable = !originalError ||
      (originalError.message.includes('ECONNREFUSED') ||
       originalError.message.includes('ETIMEDOUT') ||
       originalError.message.includes('ENOTFOUND'));
  }

  readonly url?: string;
  readonly originalError?: Error;
}

/**
 * Timeout errors (not retryable)
 * Example: Query took too long
 */
export class TimeoutError extends AgentError {
  readonly code = 'TIMEOUT_ERROR' as const;
  readonly retryable = false as const;

  constructor(
    message: string,
    context: Readonly<{
      timeout: number;
      duration: number;
      operation: string;
    }>
  ) {
    super(message, context);
  }
}

/**
 * Token budget exceeded (not retryable)
 * Example: Used more tokens than budget allows
 */
export class BudgetExceededError extends AgentError {
  readonly code = 'BUDGET_EXCEEDED' as const;
  readonly retryable = false as const;

  constructor(
    message: string,
    context: Readonly<{
      budget: number;
      used: number;
      step: number;
    }>
  ) {
    super(message, context);
  }
}

/**
 * Max steps exceeded (not retryable)
 * Example: Agent looped too many times
 */
export class MaxStepsError extends AgentError {
  readonly code = 'MAX_STEPS_EXCEEDED' as const;
  readonly retryable = false as const;

  constructor(
    message: string,
    context: Readonly<{
      maxSteps: number;
      actualSteps: number;
      reason: string;
    }>
  ) {
    super(message, context);
  }
}

/**
 * State machine errors (not retryable)
 * Example: Invalid state transition
 */
export class StateMachineError extends AgentError {
  readonly code = 'STATE_MACHINE_ERROR' as const;
  readonly retryable = false as const;

  constructor(
    message: string,
    context: Readonly<{
      fromState: string;
      toState: string;
      allowedTransitions: ReadonlyArray<string>;
    }>
  ) {
    super(message, context);
  }
}

/**
 * Type guard for retryable errors
 */
export function isRetryable(error: AgentError): error is Extract<AgentError, { retryable: true }> {
  return error.retryable;
}

/**
 * Type guard for non-retryable errors
 */
export function isNonRetryable(error: AgentError): error is Extract<AgentError, { retryable: false }> {
  return !error.retryable;
}

/**
 * Convert unknown error to AgentError
 */
export function toAgentError(error: unknown): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    return new LLMError(error.message, {
      provider: 'unknown',
      originalError: error,
    });
  }

  if (typeof error === 'string') {
    return new LLMError(error, { provider: 'unknown' });
  }

  return new LLMError(String(error), { provider: 'unknown' });
}
