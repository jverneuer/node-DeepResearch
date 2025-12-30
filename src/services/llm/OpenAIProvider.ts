/**
 * OpenAI LLM Provider
 *
 * Implements LLM provider interface for OpenAI API
 */

import type {
  LLMProvider,
  ChatMessage,
  GenerationOptions,
  GenerationResult,
  EmbeddingResult,
  StreamEvent,
} from './LLMProvider.js';
import type { LLMProviderConfig } from '@core/types/schemas.js';

interface OpenAIConfig extends LLMProviderConfig {
  readonly name: 'openai';
  readonly baseUrl?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: OpenAIConfig) {
    this.name = 'openai';
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate text completion
   */
  async generate(request: {
    messages: ReadonlyArray<ChatMessage>;
  } & GenerationOptions): Promise<GenerationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const messages: OpenAIMessage[] = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();

      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No choices returned from OpenAI');
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        model: data.model,
        finishReason: choice.finish_reason as 'stop' | 'length' | 'content_filter',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate with streaming
   */
  async *generateStream(request: {
    messages: ReadonlyArray<ChatMessage>;
  } & GenerationOptions): AsyncIterable<StreamEvent> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const messages: OpenAIMessage[] = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        yield {
          type: 'error',
          error: `OpenAI API error: ${error.error?.message || response.statusText}`,
        };
        return;
      }

      // Read streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) {
              yield { type: 'token', content: delta };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      yield { type: 'done' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'error', error: 'Request timeout' };
      } else {
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate embedding
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data: OpenAIEmbeddingResponse = await response.json();

      const embedding = data.data[0];
      if (!embedding) {
        throw new Error('No embedding returned');
      }

      return {
        embedding: embedding.embedding,
        model: data.model,
        usage: {
          totalTokens: data.usage.total_tokens,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
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
  getConfig(): LLMProviderConfig {
    return {
      name: 'openai',
      apiKey: this.apiKey,
      model: this.model,
      timeout: this.timeout,
    };
  }
}
