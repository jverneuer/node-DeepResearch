/**
 * LLM Provider - Abstract interface for LLM providers
 *
 * Supports multiple providers (OpenAI, Gemini, Anthropic)
 * with unified interface and error handling
 */

import { z } from 'zod';
import type { LLMProviderConfig } from '@core/types/schemas.js';

/**
 * Chat message
 */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Generation options
 */
export interface GenerationOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stop?: ReadonlyArray<string>;
}

/**
 * Generation result
 */
export interface GenerationResult {
  readonly content: string;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly model: string;
  readonly finishReason: 'stop' | 'length' | 'content_filter';
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  readonly embedding: ReadonlyArray<number>;
  readonly model: string;
  readonly usage: {
    readonly totalTokens: number;
  };
}

/**
 * Stream event
 */
export interface StreamEvent {
  readonly type: 'token' | 'done' | 'error';
  readonly content?: string;
  readonly error?: string;
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  /**
   * Get provider name
   */
  readonly name: string;

  /**
   * Get model name
   */
  readonly model: string;

  /**
   * Generate text completion
   */
  generate(request: {
    messages: ReadonlyArray<ChatMessage>;
  } & GenerationOptions): Promise<GenerationResult>;

  /**
   * Generate with streaming
   */
  generateStream(request: {
    messages: ReadonlyArray<ChatMessage>;
  } & GenerationOptions): AsyncIterable<StreamEvent>;

  /**
   * Generate embedding
   */
  generateEmbedding(text: string): Promise<EmbeddingResult>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get configuration
   */
  getConfig(): LLMProviderConfig;
}

/**
 * Provider-specific configurations
 */

export interface OpenAIConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model: string;
  readonly timeout?: number;
}

export interface GeminiConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly timeout?: number;
}

export interface AnthropicConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly timeout?: number;
}

/**
 * Validation schemas
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const GenerationOptionsSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
  })
  .strict();

export const GenerationResultSchema = z.object({
  content: z.string(),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  model: z.string(),
  finishReason: z.enum(['stop', 'length', 'content_filter']),
});

export const EmbeddingResultSchema = z.object({
  embedding: z.array(z.number()),
  model: z.string(),
  usage: z.object({
    totalTokens: z.number().int().nonnegative(),
  }),
});

export type ValidatedChatMessage = z.infer<typeof ChatMessageSchema>;
export type ValidatedGenerationOptions = z.infer<typeof GenerationOptionsSchema>;
export type ValidatedGenerationResult = z.infer<typeof GenerationResultSchema>;
export type ValidatedEmbeddingResult = z.infer<typeof EmbeddingResultSchema>;

/**
 * Validate chat message
 */
export function validateChatMessage(data: unknown): ValidatedChatMessage {
  return ChatMessageSchema.parse(data);
}

/**
 * Validate generation result
 */
export function validateGenerationResult(data: unknown): ValidatedGenerationResult {
  return GenerationResultSchema.parse(data);
}

/**
 * Type guard: Is stream event token
 */
export function isTokenEvent(event: StreamEvent): event is StreamEvent & { readonly content: string } {
  return event.type === 'token' && event.content !== undefined;
}

/**
 * Type guard: Is stream event error
 */
export function isErrorEvent(event: StreamEvent): event is StreamEvent & { readonly error: string } {
  return event.type === 'error' && event.error !== undefined;
}

// Re-export implementations
export { OpenAIProvider } from './OpenAIProvider.js';
