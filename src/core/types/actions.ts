/**
 * Action types using discriminated unions
 * Ensures type-safe action handling with exhaustive checking
 */

import { z } from 'zod';

/**
 * Base action with discriminator
 */
export interface BaseAction {
  readonly id: string;
  readonly timestamp: Date;
  readonly think: string;
}

/**
 * Search action - search for information
 */
export interface SearchAction extends BaseAction {
  readonly type: 'search';
  readonly queries: ReadonlyArray<{
    readonly query: string;
    readonly priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Visit action - read specific URLs
 */
export interface VisitAction extends BaseAction {
  readonly type: 'visit';
  readonly urls: ReadonlyArray<{
    readonly url: string;
    readonly reason: string;
  }>;
}

/**
 * Answer action - provide final answer
 */
export interface AnswerAction extends BaseAction {
  readonly type: 'answer';
  readonly answer: string;
  readonly confidence: number;
  readonly references: ReadonlyArray<{
    readonly url: string;
    readonly quote: string;
  }>;
}

/**
 * Reflect action - analyze progress
 */
export interface ReflectAction extends BaseAction {
  readonly type: 'reflect';
  readonly analysis: {
    readonly currentGaps: ReadonlyArray<string>;
    readonly progress: string;
    readonly nextSteps: ReadonlyArray<string>;
  };
}

/**
 * Coding action - execute code
 */
export interface CodingAction extends BaseAction {
  readonly type: 'coding';
  readonly code: string;
  readonly language: string;
  readonly expectedOutput?: string;
}

/**
 * Union type of all actions
 * Discriminated union ensures exhaustive handling
 */
export type AgentAction =
  | SearchAction
  | VisitAction
  | AnswerAction
  | ReflectAction
  | CodingAction;

/**
 * Type guard: Search action
 */
export function isSearchAction(action: AgentAction): action is SearchAction {
  return action.type === 'search';
}

/**
 * Type guard: Visit action
 */
export function isVisitAction(action: AgentAction): action is VisitAction {
  return action.type === 'visit';
}

/**
 * Type guard: Answer action
 */
export function isAnswerAction(action: AgentAction): action is AnswerAction {
  return action.type === 'answer';
}

/**
 * Type guard: Reflect action
 */
export function isReflectAction(action: AgentAction): action is ReflectAction {
  return action.type === 'reflect';
}

/**
 * Type guard: Coding action
 */
export function isCodingAction(action: AgentAction): action is CodingAction {
  return action.type === 'coding';
}

/**
 * Get action type
 */
export function getActionType(action: AgentAction): AgentAction['type'] {
  return action.type;
}

/**
 * Validation schemas for actions
 */
export const SearchActionSchema = z.object({
  type: z.literal('search'),
  id: z.string().uuid(),
  timestamp: z.date(),
  think: z.string(),
  queries: z.array(
    z.object({
      query: z.string().min(1),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ),
});

export const VisitActionSchema = z.object({
  type: z.literal('visit'),
  id: z.string().uuid(),
  timestamp: z.date(),
  think: z.string(),
  urls: z.array(
    z.object({
      url: z.string().url(),
      reason: z.string().min(1),
    })
  ),
});

export const AnswerActionSchema = z.object({
  type: z.literal('answer'),
  id: z.string().uuid(),
  timestamp: z.date(),
  think: z.string(),
  answer: z.string().min(1),
  confidence: z.number().min(0).max(1),
  references: z.array(
    z.object({
      url: z.string().url(),
      quote: z.string().min(1),
    })
  ),
});

export const ReflectActionSchema = z.object({
  type: z.literal('reflect'),
  id: z.string().uuid(),
  timestamp: z.date(),
  think: z.string(),
  analysis: z.object({
    currentGaps: z.array(z.string()),
    progress: z.string(),
    nextSteps: z.array(z.string()),
  }),
});

export const CodingActionSchema = z.object({
  type: z.literal('coding'),
  id: z.string().uuid(),
  timestamp: z.date(),
  think: z.string(),
  code: z.string(),
  language: z.string(),
  expectedOutput: z.string().optional(),
});

/**
 * Union schema for all actions
 */
export const AgentActionSchema = z.discriminatedUnion('type', [
  SearchActionSchema,
  VisitActionSchema,
  AnswerActionSchema,
  ReflectActionSchema,
  CodingActionSchema,
]);

export type ValidatedAgentAction = z.infer<typeof AgentActionSchema>;

/**
 * Validate action
 */
export function validateAction(data: unknown): ValidatedAgentAction {
  return AgentActionSchema.parse(data);
}
