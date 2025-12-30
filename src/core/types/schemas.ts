/**
 * Zod validation schemas for all configuration
 * Runtime type safety with compile-time inference
 */

import { z } from 'zod';

/**
 * LLM provider configuration
 */
export const LLMProviderConfigSchema = z
  .object({
    name: z.enum(['openai', 'gemini', 'anthropic']),
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional(),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    timeout: z.number().int().positive().default(30_000),
  })
  .strict();

export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;

/**
 * Search provider configuration
 */
export const SearchProviderConfigSchema = z
  .object({
    name: z.enum(['jina', 'brave', 'serper']),
    apiKey: z.string().min(1),
    maxResults: z.number().int().positive().max(100).default(10),
    timeout: z.number().int().positive().default(10_000),
  })
  .strict();

export type SearchProviderConfig = z.infer<typeof SearchProviderConfigSchema>;

/**
 * Tool-specific configuration
 */
export const ToolConfigSchema = z
  .object({
    coder: z
      .object({
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .optional(),

    evaluator: z
      .object({
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
      })
      .optional(),

    agent: z
      .object({
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .strict();

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * Research limits configuration
 */
export const ResearchLimitsSchema = z
  .object({
    maxSteps: z.number().int().positive().max(1000),
    maxDuration: z.number().int().positive().max(3_600_000), // 1 hour max
    maxBadAttempts: z.number().int().nonnegative().max(10),
    tokenBudget: z.number().int().positive().max(10_000_000),
  })
  .strict();

export type ResearchLimits = z.infer<typeof ResearchLimitsSchema>;

/**
 * Feature flags
 */
export const FeatureFlagsSchema = z
  .object({
    enableTelemetry: z.boolean().default(false),
    enableCaching: z.boolean().default(true),
    enableTracing: z.boolean().default(false),
    enableMetrics: z.boolean().default(false),
  })
  .strict();

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Observability configuration
 */
export const ObservabilityConfigSchema = z
  .object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    metricsEnabled: z.boolean().default(false),
    tracingEnabled: z.boolean().default(false),
  })
  .strict();

export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;

/**
 * Complete application configuration
 */
export const AppConfigSchema = z
  .object({
    llm: LLMProviderConfigSchema,
    search: SearchProviderConfigSchema,
    tools: ToolConfigSchema.optional(),

    // Research limits
    limits: ResearchLimitsSchema,

    // Feature flags
    features: FeatureFlagsSchema,

    // Observability
    observability: ObservabilityConfigSchema,
  })
  .strict();

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Validate and parse configuration
 */
export function validateConfig(config: unknown): AppConfig {
  return AppConfigSchema.parse(config);
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): AppConfig {
  return AppConfigSchema.parse({
    llm: {
      name: (process.env['LLM_PROVIDER'] ?? 'openai') as 'openai' | 'gemini' | 'anthropic',
      apiKey:
        process.env['LLM_API_KEY'] ??
        process.env['OPENAI_API_KEY'] ??
        process.env['GEMINI_API_KEY'] ??
        process.env['ANTHROPIC_API_KEY'] ??
        '',
      baseUrl: process.env['OPENAI_BASE_URL'],
      model: process.env['DEFAULT_MODEL_NAME'] ?? 'gpt-4o-mini',
    },
    search: {
      name: (process.env['SEARCH_PROVIDER'] ?? 'jina') as 'jina' | 'brave' | 'serper',
      apiKey:
        process.env['JINA_API_KEY'] ??
        process.env['BRAVE_API_KEY'] ??
        process.env['SERPER_API_KEY'] ??
        '',
    },
    limits: {
      maxSteps: parseInt(process.env['MAX_STEPS'] ?? '100'),
      maxDuration: parseInt(process.env['MAX_DURATION'] ?? '300000'),
      maxBadAttempts: parseInt(process.env['MAX_BAD_ATTEMPTS'] ?? '3'),
      tokenBudget: parseInt(process.env['TOKEN_BUDGET'] ?? '2000000'),
    },
    observability: {
      logLevel: (process.env['LOG_LEVEL'] ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
    },
  });
}

/**
 * Validate configuration with custom error message
 */
export function validateConfigWithErrors(config: unknown): AppConfig {
  try {
    return validateConfig(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.format();
      throw new Error(`Invalid configuration:\n${formatted}`);
    }
    throw error;
  }
}
