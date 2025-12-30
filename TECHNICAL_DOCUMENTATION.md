# DeepResearch Technical Documentation & Architecture Analysis

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Execution Flow](#execution-flow)
5. [Critical Bugs](#critical-bugs)
6. [Line-by-Line Analysis](#line-by-line-analysis)

---

## System Overview

**DeepResearch** is an AI-powered research agent that iteratively:
1. **Searches** for information
2. **Reads** web content
3. **Evaluates** if it has enough information
4. **Loops** until it finds a satisfactory answer or hits token budget

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENTRY POINTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────────┐          ┌──────────────┐                   │
│   │   CLI Mode   │          │   API Mode   │                   │
│   │  (src/cli.ts)│          │  (src/app.ts)│                   │
│   └──────┬───────┘          └──────┬───────┘                   │
│          │                         │                            │
│          └───────────┬─────────────┘                            │
│                      ▼                                          │
│           ┌─────────────────────┐                               │
│           │  getResponse()      │                               │
│           │  (src/agent.ts:419) │                               │
│           └──────────┬──────────┘                               │
│                      │                                          │
│                      ▼                                          │
│           ┌─────────────────────┐                               │
│           │  MAIN WHILE LOOP    │◄───────┐                    │
│           │  (agent.ts:518)     │        │                    │
│           └──────────┬──────────┘        │                    │
│                      │                   │                    │
│          ┌───────────┼───────────┐       │                    │
│          ▼           ▼           ▼       │                    │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐  │                    │
│    │ Search  │ │  Read   │ │ Reflect │  │                    │
│    │ Visit   │ │ Answer  │ │  Coding │  │                    │
│    └────┬────┘ └────┬────┘ └────┬────┘  │                    │
│         │           │            │       │                    │
│         └───────────┼────────────┘       │                    │
│                     ▼                    │                    │
│          ┌─────────────────┐             │                    │
│          │ Evaluation      │             │                    │
│          │ Pass?           │             │                    │
│          └────┬───────┬────┘             │                    │
│               │       │                  │                    │
│          YES  │       │  NO              │                    │
│          ┌────┘       │  ┌───────────────┘                    │
│          ▼            │  ▼                                    │
│     ┌────────┐       │ ┌──────────┐                          │
│     │ BREAK  │       │ │ CONTINUE │◄─────────────────────────┘
│     └────────┘       │ └──────────┘
│                      │
│                      ▼
│               ┌─────────────┐
│               │ Return      │
│               │ Result      │
│               └─────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Directory Structure

```
node-DeepResearch/
├── src/
│   ├── agent.ts           # CORE: Main research loop & logic
│   ├── app.ts             # API server (Express)
│   ├── cli.ts             # CLI interface (Commander.js)
│   ├── config.ts          # Configuration management
│   ├── types.ts           # TypeScript type definitions
│   ├── logging.ts         # Logging utilities
│   ├── tools/             # Research tools
│   │   ├── search.ts      # Search functionality
│   │   ├── visit.ts       # Web scraping
│   │   ├── query-rewriter.ts
│   │   ├── serp-cluster.ts
│   │   └── ...
│   └── utils/             # Utilities
│       ├── token-tracker.ts
│       ├── action-tracker.ts
│       └── safe-generator.ts
├── config.json            # Model configuration
├── .env                   # API keys & settings
└── package.json
```

### Component Relationships

```
┌──────────────────────────────────────────────────────────┐
│                    CONFIGURATION LAYER                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐│
│  │ config.json  │   │    .env      │   │ CLI Args     ││
│  │ (models)     │   │  (API keys)  │   │ (--token-    ││
│  │              │   │              │   │  budget)     ││
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘│
│         │                   │                   │       │
│         └───────────────────┼───────────────────┘       │
│                             ▼                           │
│                  ┌─────────────────────┐                │
│                  │   Config Manager    │                │
│                  │   (src/config.ts)   │                │
│                  └──────────┬──────────┘                │
└─────────────────────────────┼──────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────┐
│                     EXECUTION LAYER                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ENTRY POINTS                        │   │
│  ├─────────────────────────────────────────────────┤   │
│  │                                                  │   │
│  │  ┌──────────────┐      ┌──────────────┐        │   │
│  │  │  CLI Mode    │      │  API Mode    │        │   │
│  │  │  src/cli.ts  │      │  src/app.ts  │        │   │
│  │  │              │      │              │        │   │
│  │  │  Usage:      │      │  Express:    │        │   │
│  │  │  npm run dev │      │  POST /v1/   │        │   │
│  │  │  "query"     │      │  chat/       │        │   │
│  │  │              │      │  completions │        │   │
│  │  └──────┬───────┘      └──────┬───────┘        │   │
│  │         │                     │                │   │
│  │         └──────────┬──────────┘                │   │
│  │                    ▼                           │   │
│  │         ┌──────────────────────┐               │   │
│  │         │   getResponse()      │               │   │
│  │         │   src/agent.ts:419   │               │   │
│  │         └───────────┬──────────┘               │   │
│  └─────────────────────┼──────────────────────────┘   │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              MAIN LOOP                          │   │
│  │         src/agent.ts:518-1100                   │   │
│  │                                                  │   │
│  │   while (tokens < budget) {                     │   │
│  │     1. Generate action (search/read/answer)      │   │
│  │     2. Execute action                           │   │
│  │     3. Evaluate result                          │   │
│  │     4. Break if done                            │   │
│  │     5. Otherwise continue loop                   │   │
│  │   }                                              │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                               │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TOOLS LAYER                         │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │  Search  │  │  Visit   │  │   Evaluator  │  │   │
│  │  │  Jina/   │  │  Web     │  │   Quality     │  │   │
│  │  │  Brave/  │  │  Scrap-  │  │   Check       │  │   │
│  │  │  Serper  │  │  ing     │  │               │  │   │
│  │  └──────────┘  └──────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐     │
│  │ LLM Provi- │  │  Search    │  │   Token      │     │
│  │ der        │  │  Provider  │  │   Tracker    │     │
│  │            │  │            │  │              │     │
│  │ • OpenAI   │  │ • Jina AI  │  │ • Usage      │     │
│  │ • Gemini   │  │ • Brave    │  │ • Budget     │     │
│  │ • OpenRouter│ │ • Serper   │  │ • Cost       │     │
│  └────────────┘  └────────────┘  └──────────────┘     │
└──────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Entry Points

#### CLI Mode (`src/cli.ts`)

**Purpose**: Command-line interface for direct queries

```typescript
// Lines 25-31: Main CLI handler
.action(async (query: string, options: any) => {
  const { result } = await getResponse(
    query,                    // The research question
    2000000,                  // Token budget (default: 2M)
    3,                        // Max bad attempts (default: 3)
  );

  if (result.action === 'answer') {
    logInfo('\nAnswer:', { answer: result.answer });
    if (result.references?.length) {
      logInfo('\nReferences:');
      for (const ref of result.references) {
        logInfo(`- ${ref.url}`);
        logInfo(`  "${ref.exactQuote}"`);
      }
    }
  }
});
```

**Key Points**:
- Always uses query string (not messages array)
- `noDirectAnswer` is always `undefined` (falsy)
- Lower token budget (2M vs API's 2M/1M/200K)
- Simpler configuration

#### API Mode (`src/app.ts`)

**Purpose**: Express server providing OpenAI-compatible API

```typescript
// Lines 617-632: API handler
const { result, visitedURLs, readURLs, allURLs, imageReferences }
  = await getResponse(
    undefined,                // No query string (uses messages)
    tokenBudget,              // From reasoning effort setting
    maxBadAttempts,           // From reasoning effort setting
    context,                  // Reusable context
    body.messages,            // Chat messages array
    body.max_returned_urls,   // URL limit
    body.no_direct_answer,    // ⚠️ CAN BE TRUE - CAUSES INFINITE LOOPS
    body.boost_hostnames,
    body.bad_hostnames,
    body.only_hostnames,
    body.max_annotations,
    body.min_annotation_relevance,
    body.language_code,
    body.search_language_code,
    body.search_provider,
    body.with_images,
);
```

**Key Points**:
- Uses `messages` array (OpenAI format)
- `noDirectAnswer` parameter can be set by user
- More configuration options
- Supports streaming responses
- Can reuse context across requests

### 2. Main Research Loop (`src/agent.ts`)

#### Function Signature

```typescript
// Line 419-436
export async function getResponse(
  question?: string,                          // Research question
  tokenBudget: number = 1_000_000,           // Max tokens to spend
  maxBadAttempts: number = 2,                // Retry limit
  existingContext?: Partial<TrackerContext>, // Reusable state
  messages?: Array<CoreMessage>,             // Chat messages
  numReturnedURLs: number = 100,
  noDirectAnswer: boolean = false,           // ⚠️ CRITICAL: Can cause infinite loops
  boostHostnames: string[] = [],
  badHostnames: string[] = [],
  onlyHostnames: string[] = [],
  maxRef: number = 10,
  minRelScore: number = 0.80,
  languageCode: string | undefined = undefined,
  searchLanguageCode?: string,
  searchProvider?: string,
  withImages: boolean = false,
  teamSize: number = 1
): Promise<{
  result: StepAction;           // Final answer or action
  context: TrackerContext;       // Full execution state
  visitedURLs: string[];         // All visited URLs
  readURLs: string[];            // Successfully read URLs
  allURLs: string[];             // All discovered URLs
  imageReferences?: ImageReference[]
}>
```

#### Initialization (Lines 438-517)

```typescript
let step = 0;                      // Current sub-step
let totalStep = 0;                 // Global step counter
const allContext: StepAction[] = []; // All steps taken

const allKnowledge: KnowledgeItem[] = [];  // Accumulated knowledge
let diaryContext = [];              // Context for LLM
let weightedURLs: BoostedSearchSnippet[] = [];
let allowAnswer = true;             // Permissions
let allowSearch = true;
let allowRead = true;
let allowReflect = true;
let allowCoding = false;
let thisStep: StepAction = { action: 'answer', answer: '', references: [], think: '', isFinal: false };

const allURLs: Record<string, SearchSnippet> = {};
const visitedURLs: string[] = [];
const badURLs: string[] = [];
const evaluationMetrics: Record<string, RepeatEvaluationType[]> = {};

// ⚠️ CRITICAL: Only 85% of budget for main loop
const regularBudget = tokenBudget * 0.85;  // 15% reserved for "beast mode"
```

---

## Execution Flow

### Main While Loop Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHILE LOOP ENTRY                            │
│                    Line 518                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  while (context.tokenTracker.getTotalUsage().totalTokens       │
│         < regularBudget) {                                     │
│                                                                  │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  STEP 1: INCREMENT COUNTERS                          │    │
│    │  Lines 520-523                                       │    │
│    ├──────────────────────────────────────────────────────┤    │
│    │  step++;                                              │    │
│    │  totalStep++;                                         │    │
│    │  Log: "Step X / Budget used Y%"                      │    │
│    └──────────────────────────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  STEP 2: SELECT CURRENT QUESTION                     │    │
│    │  Lines 524-544                                       │    │
│    ├──────────────────────────────────────────────────────┤    │
│    │  const currentQuestion = gaps[totalStep % gaps.length]│   │
│    │                                                       │    │
│    │  // Setup evaluation metrics                         │    │
│    │  if (currentQuestion === question) {                 │    │
│    │    evaluationMetrics[currentQuestion] =              │    │
│    │      await evaluateQuestion(...);                    │    │
│    │  }                                                    │    │
│    └──────────────────────────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  STEP 3: GENERATE ACTION                             │    │
│    │  Lines 571-597                                       │    │
│    ├──────────────────────────────────────────────────────┤    │
│    │  // Build prompt with context                        │    │
│    │  const { system, urlList } = getPrompt(...);         │    │
│    │                                                       │    │
│    │  // Get schema for allowed actions                   │    │
│    │  schema = SchemaGen.getAgentSchema(...);             │    │
│    │                                                       │    │
│    │  // Call LLM                                         │    │
│    │  const result = await generator.generateObject({     │    │
│    │    model: 'agent',                                   │    │
│    │    schema,                                           │    │
│    │    system,                                           │    │
│    │    messages: msgWithKnowledge,                       │    │
│    │    numRetries: 2,                                    │    │
│    │  });                                                 │    │
│    │                                                       │    │
│    │  // Extract action decision                         │    │
│    │  thisStep = {                                        │    │
│    │    action: result.object.action,                    │    │
│    │    think: result.object.think,                      │    │
│    │    ...result.object[result.object.action]           │    │
│    │  }                                                   │    │
│    └──────────────────────────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  STEP 4: EXECUTE ACTION                             │    │
│    │  Lines 612-1100                                     │    │
│    ├──────────────────────────────────────────────────────┤    │
│    │  if (thisStep.action === 'search') {                 │    │
│    │    // Execute search queries                         │    │
│    │  } else if (thisStep.action === 'visit') {           │    │
│    │    // Scrape and read URLs                           │    │
│    │  } else if (thisStep.action === 'answer') {          │    │
│    │    // ⚠️ CRITICAL: Check if should stop              │    │
│    │    if (totalStep === 1 && !noDirectAnswer) {         │    │
│    │      break;  // ✅ STOP                              │    │
│    │    }                                                  │    │
│    │                                                       │    │
│    │    // Evaluate answer quality                        │    │
│    │    if (evaluation.pass) {                            │    │
│    │      break;  // ✅ STOP                              │    │
│    │    } else {                                          │    │
│    │      // ❌ CONTINUE - MAY LOOP FOREVER              │    │
│    │      allowAnswer = false;                            │    │
│    │      step = 0;  // Reset step counter               │    │
│    │    }                                                  │    │
│    │  }                                                    │    │
│    └──────────────────────────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  LOOP BACK TO TOP (unless break)                     │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                  │
│  } // End while                                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  STEP 5: RETURN RESULT                               │    │
│  │  Lines 1100+                                         │    │
│    ├──────────────────────────────────────────────────────┤    │
│    │  return {                                            │    │
│    │    result: finalStep,                                │    │
│    │    context,                                          │    │
│    │    visitedURLs,                                      │    │
│    │    readURLs,                                         │    │
│    │    allURLs,                                          │    │
│    │    imageReferences,                                  │    │
│    │  };                                                  │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Action Decision Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                 ACTION GENERATION (Line 586)                    │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  Call LLM with Structured Output     │
         │  (AI SDK generateObject)            │
         └────────────┬─────────────────────────┘
                      │
                      ▼
         ┌──────────────────────────────────────┐
         │  Schema Determines Allowed Actions   │
         └────────────┬─────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┐
         │            │            │            │
         ▼            ▼            ▼            ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ SEARCH  │ │  READ   │ │ ANSWER  │ │ REFLECT │
    │ action  │ │ action  │ │ action  │ │ action  │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
    Execute     Execute     Execute     Execute
    Search      URLs        Evaluation  Reflection
    Queries     Scraping    Logic       Generation
```

### Answer Action Flow (THE BUGGY PART)

```
┌─────────────────────────────────────────────────────────────────┐
│              ANSWER ACTION HANDLER (Lines 612-850)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  if (thisStep.action === 'answer' && thisStep.answer) {        │
│                                                                  │
│    ┌─────────────────────────────────────────────────────┐     │
│    │  CHECK 1: Immediate Answer (Step 1)                 │     │
│    │  Lines 616-622                                      │     │
│    ├─────────────────────────────────────────────────────┤     │
│    │                                                      │     │
│    │  if (totalStep === 1 && !noDirectAnswer) {          │     │
│    │    // ✅ GOOD: Breaks immediately                  │     │
│    │    thisStep.isFinal = true;                         │     │
│    │    break;  // ← STOPS LOOP                          │     │
│    │  }                                                   │     │
│    │                                                      │     │
│    │  ⚠️ PROBLEM: If noDirectAnswer=true, SKIPS THIS     │     │
│    │           and continues to evaluation!             │     │
│    └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│    ┌─────────────────────────────────────────────────────┐     │
│    │  CHECK 2: Evaluate Answer Quality                  │     │
│    │  Lines 648-663                                      │     │
│    ├─────────────────────────────────────────────────────┤     │
│    │                                                      │     │
│    │  evaluation = await evaluateAnswer(                 │     │
│    │    currentQuestion,                                 │     │
│    │    thisStep,                                        │     │
│    │    evaluationMetrics,                               │     │
│    │    context,                                         │     │
│    │    allKnowledge,                                    │     │
│    │    SchemaGen                                        │     │
│    │  );                                                 │     │
│    │                                                      │     │
│    │  // Returns: { pass: boolean, think: string }      │     │
│    └─────────────────────────────────────────────────────┘     │
│                         │                                       │
│                         ▼                                       │
│    ┌─────────────────────────────────────────────────────┐     │
│    │  CHECK 3: Original Question?                       │     │
│    │  Lines 665-747                                      │     │
│    ├─────────────────────────────────────────────────────┤     │
│    │                                                      │     │
│    │  if (currentQuestion.trim() === question) {         │     │
│    │    // We're answering the main question            │     │
│    │                                                      │     │
│    │    ┌───────────────────────────────────────┐       │     │
│    │    │  BRANCH A: Evaluation Passed         │       │     │
│    │    │  Lines 669-685                        │       │     │
│    │    ├───────────────────────────────────────┤       │     │
│    │    │                                        │       │     │
│    │    │  if (evaluation.pass) {               │       │     │
│    │    │    // ✅ GOOD: Breaks                │       │     │
│    │    │    thisStep.isFinal = true;           │       │     │
│    │    │    break;  // ← STOPS LOOP            │       │     │
│    │    │  }                                    │       │     │
│    │    └───────────────────────────────────────┘       │     │
│    │                │                                 │     │
│    │                │ ELSE                           │     │
│    │                ▼                                 │     │
│    │    ┌───────────────────────────────────────┐       │     │
│    │    │  BRANCH B: Evaluation FAILED          │       │     │
│    │    │  Lines 686-747                        │       │     │
│    │    ├───────────────────────────────────────┤       │     │
│    │    │                                        │       │     │
│    │    │  // Decrease retry counts             │       │     │
│    │    │  evaluationMetrics = evaluationMetrics │       │     │
│    │    │    .map(e => {                         │       │     │
│    │    │      e.numEvalsRequired--;             │       │     │
│    │    │      return e;                         │       │     │
│    │    │    })                                  │       │     │
│    │    │    .filter(e => e.numEvalsRequired > 0);│     │
│    │    │                                        │       │     │
│    │    │  if (evaluationMetrics.length === 0) { │       │     │
│    │    │    // ✅ GOOD: Finally breaks         │       │     │
│    │    │    thisStep.isFinal = false;           │       │     │
│    │    │    break;  // ← STOPS LOOP            │       │     │
│    │    │  }                                    │       │     │
│    │    │                                        │       │     │
│    │    │  // ❌ BAD: CONTINUES LOOP           │       │     │
│    │    │  allowAnswer = false;  // Disable     │       │     │
│    │    │  diaryContext = [];    // Clear       │       │     │
│    │    │  step = 0;              // Reset       │       │     │
│    │    │  // LOOP CONTINUES → INFINITE LOOP    │       │     │
│    │    │                                        │       │     │
│    │    │  // Analyze failure                    │       │     │
│    │    │  const errorAnalysis = await analyzeSteps(│    │     │
│    │    │    diaryContext,                        │       │     │
│    │    │    context,                             │       │     │
│    │    │    SchemaGen                            │       │     │
│    │    │  );                                     │       │     │
│    │    │                                        │       │     │
│    │    │  // Add to knowledge                   │       │     │
│    │    │  allKnowledge.push({ ... });           │       │     │
│    │    │                                        │       │     │
│    │    └───────────────────────────────────────┘       │     │
│    │  }                                                  │     │
│    └─────────────────────────────────────────────────────┘     │
│  }                                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Bugs

### Bug #1: Infinite Answer Loop

**Location**: `src/agent.ts:616-747`

**Description**: When the agent answers a question, it may not stop and instead loops forever.

**Root Cause**:

```typescript
// Line 616-622
if (totalStep === 1 && !noDirectAnswer) {
  thisStep.isFinal = true;
  break;  // Only breaks if totalStep === 1 AND noDirectAnswer === false
}

// If the above check fails, we continue to evaluation

// Line 669-685
if (evaluation.pass) {
  thisStep.isFinal = true;
  break;  // Breaks if evaluation passes
} else {
  // Line 686-747
  if (evaluationMetrics.length === 0) {
    break;  // Breaks if out of retries
  } else {
    // ❌ BUG: Continues loop forever
    allowAnswer = false;
    diaryContext = [];
    step = 0;  // Reset step counter but continue while loop
    // No break statement!
  }
}
```

**When It Triggers**:

1. **Scenario A**: `noDirectAnswer = true` (API mode)
   - Step 1 answer doesn't break at line 621
   - Goes to evaluation
   - If evaluation fails → infinite loop

2. **Scenario B**: Evaluation keeps failing
   - Evaluation metrics never reach 0
   - Loop continues indefinitely
   - Each iteration = 1 API call

**Evidence**:

From the logs:
```
Step 1 / Budget used 0.40% → action: "answer", answer: "2+2 equals 4"
Step 2 / Budget used 0.52% → action: "answer", answer: "2+2 equals 4"
Step 3 / Budget used 0.64% → action: "answer", answer: "2+2 equals 4"
...
Step 31 / Budget used 3.96% → action: "answer", answer: "2+2 equals 4"
```

31+ iterations = 31+ API calls = Rapid rate limit consumption

**Impact**:
- **Wastes API quota**: Can make 100+ calls per minute
- **Never completes**: User has to kill process
- **No error message**: Appears to be working but isn't
- **Hits rate limits**: Quickly exceeds daily limits

---

### Bug #2: JSON Parsing Retry Loop

**Location**: `src/utils/safe-generator.ts` (used by agent.ts)

**Description**: When LLM fails to generate valid JSON, the system retries indefinitely.

**Flow**:

```
┌─────────────────────────────────────────────────────────┐
│  Agent calls generateObject() with schema              │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Try: Generate object with schema                      │
│  result = await llm.generateObject({ schema, ... })     │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
       ┌──────────┐
       │ Success? │
       └────┬─────┘
            │
    ┌───────┴────────┐
    │                │
   YES               NO
    │                │
    │                ▼
    │    ┌──────────────────────────────────────┐
    │    │  FALLBACK 1: Manual JSON parsing     │
    │    │  (Try to extract JSON from text)     │
    │    └────────────┬─────────────────────────┘
    │                 │
    │                 ▼
    │         ┌──────────────┐
    │         │  Parse OK?   │
    │         └──────┬───────┘
    │                │
    │        ┌───────┴────────┐
    │        │                │
    │       YES               NO
    │        │                │
    │        │                ▼
    │        │    ┌──────────────────────────────────────┐
    │        │    │  FALLBACK 2: jsonrepair              │
    │        │    │  (Try to fix malformed JSON)         │
    │        │    └────────────┬─────────────────────────┘
    │        │                 │
    │        │                 ▼
    │        │         ┌──────────────┐
    │        │         │  Repair OK?  │
    │        │         └──────┬───────┘
    │        │                │
    │        │        ┌───────┴────────┐
    │        │        │                │
    │        │       YES               NO
    │        │        │                │
    │        │        │                ▼
    │        │        │    ┌──────────────────────────────────────┐
    │        │        │    │  FALLBACK 3: Hjson                   │
    │        │        │    │  (Try more lenient parsing)          │
    │        │        │    └────────────┬─────────────────────────┘
    │        │        │                 │
    │        │        │                 ▼
    │        │        │         ┌──────────────┐
    │        │        │         │  Hjson OK?   │
    │        │        │         └──────┬───────┘
    │        │        │                │
    │        │        │        ┌───────┴────────┐
    │        │        │        │                │
    │        │        │       YES               NO
    │        │        │        │                │
    │        │        │        │                ▼
    │        │        │        │    ┌────────────────────────────────┐
    │        │        │        │    │  FALLBACK 4: Distilled Schema   │
    │        │        │        │    │  (Try simpler schema)          │
    │        │        │        │    └────────────┬───────────────────┘
    │        │        │        │                 │
    │        │        │        │                 ▼
    │        │        │        │          ┌──────────────┐
    │        │        │        │          │  Success?    │
    │        │        │        │          └──────┬───────┘
    │        │        │        │                 │
    │        │        │        │         ┌───────┴────┐
    │        │        │        │         │              │
    │        │        │        │        YES             NO
    │        │        │        │         │              │
    │        │        │        │         │              ▼
    │        │        │        │         │    ┌────────────────────┐
    │        │        │        │         │    │  ❌ THROW ERROR   │
    │        │        │        │         │    │  "All JSON parsing │
    │        │        │        │         │    │   attempts failed" │
    │        │        │        │         │    └────────────────────┘
    │        │        │        │         │
    └────────┼────────┼────────┼─────────┘
             │        │        │
             ▼        ▼        ▼
      ┌────────────────────────┐
      │  Return result         │
      │  Continue execution    │
      └────────────────────────┘
```

**Problem**: When all fallbacks fail, the error is caught but the **main loop doesn't break** - it just tries again on the next iteration.

**Evidence**:

```
{"severity":"WARNING","message":"agent failed on object generation -> manual parsing failed -> retry with 1 retries remaining"}
{"severity":"WARNING","message":"agent failed on object generation -> manual parsing failed -> retry with 0 retries remaining"}
{"severity":"WARNING","message":"agent failed on object generation -> manual parsing failed -> trying fallback with distilled schema"}
// (then same thing repeats next loop iteration)
```

---

### Bug #3: Missing Termination Conditions

**Location**: `src/agent.ts:518` (while loop)

**Description**: The while loop has only ONE termination condition: token budget.

**Current Code**:

```typescript
while (context.tokenTracker.getTotalUsage().totalTokens < regularBudget) {
  // ... research logic ...
}
```

**Missing Safeguards**:

1. ❌ No max step count
2. ❌ No wall-clock timeout
3. ❌ No consecutive failure limit
4. ❌ No maximum answer attempts
5. ❌ No forced exit after N hours

**Consequences**:

- Can run for 24+ hours if tokens aren't consumed
- Can make 10,000+ API calls in one session
- Never stops if stuck in retry loops

**Example Timeline**:

```
Time 00:00 → Start query "what is 2+2?"
Time 00:05 → Step 31, still answering "2+2 = 4"
Time 00:10 → Step 62, still answering "2+2 = 4"
Time 01:00 → Step 372, still answering "2+2 = 4"
Time 24:00 → Still running, 8,928 API calls later
```

---

## Line-by-Line Analysis

### `src/agent.ts` - Main Loop Entry

```typescript
// Lines 518-523
while (context.tokenTracker.getTotalUsage().totalTokens < regularBudget) {
  // ⚠️ CRITICAL: Only exit condition is token budget
  // Missing: max steps, timeout, consecutive failures

  step++;
  totalStep++;
  const budgetPercentage = (context.tokenTracker.getTotalUsage().totalTokens / tokenBudget * 100).toFixed(2);
  logDebug(`Step ${totalStep} / Budget used ${budgetPercentage}%`, { gaps });
```

**Documentation**:
- **Line 518**: Main research loop condition
  - Checks if total tokens used < 85% of token budget
  - **BUG**: No other exit conditions
  - **Missing**: Max steps, timeout, failure limits

- **Line 520**: Increment sub-step counter
  - Used for tracking within current research cycle
  - Can be reset to 0 (line 746)

- **Line 521**: Increment global step counter
  - Never resets
  - Used for overall progress tracking
  - **BUG**: Not used for termination

- **Line 522-523**: Log progress
  - Shows current step number
  - Shows token budget percentage used

---

### `src/agent.ts` - Current Question Selection

```typescript
// Lines 524-544
allowReflect = allowReflect && (gaps.length <= MAX_REFLECT_PER_STEP);
const currentQuestion: string = gaps[totalStep % gaps.length];

if (currentQuestion.trim() === question && totalStep === 1) {
  evaluationMetrics[currentQuestion] =
    (await evaluateQuestion(currentQuestion, context, SchemaGen)).map(e => {
      return {
        type: e,
        numEvalsRequired: maxBadAttempts
      } as RepeatEvaluationType
    })
  evaluationMetrics[currentQuestion].push({ type: 'strict', numEvalsRequired: maxBadAttempts });
} else if (currentQuestion.trim() !== question) {
  evaluationMetrics[currentQuestion] = []
}
```

**Documentation**:
- **Line 524**: Disable reflection if too many gaps
  - Prevents unlimited reflection actions
  - MAX_REFLECT_PER_STEP = constant limit

- **Line 526**: Select current question from gaps array
  - **BUG**: Uses modulo operator - cycles through same questions
  - If gaps has 1 question, always processes that question
  - Can cause repetitive loops

- **Lines 531-542**: Initialize evaluation metrics for main question
  - Only happens on step 1 for original question
  - Evaluates what type of checks are needed
  - Adds strict evaluation (required)
  - Sub-questions get empty evaluation array

---

### `src/agent.ts` - Action Generation

```typescript
// Lines 571-597
const { system, urlList } = getPrompt(
  diaryContext,
  allQuestions,
  allKeywords,
  allowReflect,
  allowAnswer,
  allowRead,
  allowSearch,
  allowCoding,
  allKnowledge,
  weightedURLs,
  false,
);

schema = SchemaGen.getAgentSchema(allowReflect, allowRead, allowAnswer, allowSearch, allowCoding, currentQuestion)
msgWithKnowledge = composeMsgs(messages, allKnowledge, currentQuestion, currentQuestion === question ? finalAnswerPIP : undefined);

const result = await generator.generateObject({
  model: 'agent',
  schema,
  system,
  messages: msgWithKnowledge,
  numRetries: 2,
});

thisStep = {
  action: result.object.action,
  think: result.object.think,
  ...result.object[result.object.action]
} as StepAction;

const actionsStr = [allowSearch, allowRead, allowAnswer, allowReflect, allowCoding].map((a, i) => a ? ['search', 'read', 'answer', 'reflect'][i] : null).filter(a => a).join(', ');
logDebug(`Step decision: ${thisStep.action} <- [${actionsStr}]`, { thisStep, currentQuestion });
```

**Documentation**:
- **Lines 571-583**: Generate prompt for LLM
  - Builds system prompt with research context
  - Includes diary of previous steps
  - Lists available actions
  - Includes knowledge from previous steps
  - Provides URLs to consider

- **Line 584**: Generate schema for structured output
  - Creates JSON schema defining allowed actions
  - Different schemas based on what actions are allowed
  - **BUG**: Complex schemas cause LLM failures

- **Line 585**: Compose messages with knowledge
  - Adds previous answers to context
  - Includes improvement plan for main question

- **Lines 586-592**: Call LLM to generate action decision
  - Uses AI SDK's `generateObject()` for structured output
  - **BUG**: `numRetries: 2` but doesn't prevent infinite loops
  - Each retry = 1 API call
  - Can fail repeatedly with complex schemas

- **Lines 593-597**: Extract action from LLM response
  - Gets the action type (search/visit/answer/reflect/coding)
  - Gets action-specific data (URLs, answer text, etc.)
  - Logs the decision

---

### `src/agent.ts` - Answer Action Handler (THE BUGGY PART)

```typescript
// Lines 612-622
if (thisStep.action === 'answer' && thisStep.answer) {
  if (totalStep === 1 && !noDirectAnswer) {
    // LLM is so confident and answer immediately, skip all evaluations
    // however, if it does give any reference, it must be evaluated
    thisStep.isFinal = true;
    trivialQuestion = true;
    break
  }
```

**Documentation**:
- **Line 612**: Check if action is 'answer' and has answer text
  - Only processes answers with actual content

- **Line 616**: Check for immediate answer conditions
  - `totalStep === 1`: First step of research
  - `!noDirectAnswer`: Allow direct answers (CLI mode)
  - **BUG**: When `noDirectAnswer=true`, this break is skipped

- **Line 619**: Mark as final answer
  - Sets `isFinal = true` flag
  - Sets `trivialQuestion = true` flag

- **Line 621**: **BREAK LOOP**
  - ✅ **GOOD**: This is one of the few places that actually stops
  - **PROBLEM**: Only happens in very specific conditions

- **What if the check fails?**
  - Continues to line 648 (evaluation)
  - May never break if evaluation keeps failing

---

### `src/agent.ts` - Answer Evaluation

```typescript
// Lines 648-663
updateContext({
  totalStep,
  question: currentQuestion,
  ...thisStep,
});

logDebug('Current question evaluation:', {
  question: currentQuestion,
  types: evaluationMetrics[currentQuestion]
});

let evaluation: EvaluationResponse = { pass: true, think: '' };
if (evaluationMetrics[currentQuestion].length > 0) {
  context.actionTracker.trackThink('eval_first', SchemaGen.languageCode)
  evaluation = await evaluateAnswer(
    currentQuestion,
    thisStep,
    evaluationMetrics[currentQuestion].filter(e => e.numEvalsRequired > 0).map(e => e.type),
    context,
    allKnowledge,
    SchemaGen
  ) || evaluation;
}
```

**Documentation**:
- **Lines 642-647**: Add answer to context
  - Records the step in allContext array
  - Preserves question and answer

- **Lines 648-651**: Log evaluation setup
  - Shows what question is being evaluated
  - Shows what types of evaluations are needed

- **Line 652**: Initialize evaluation result
  - Default: `{ pass: true, think: '' }`
  - **BUG**: Defaults to passing if no evaluation runs

- **Lines 653-663**: Run evaluation if metrics exist
  - Only evaluates if evaluation metrics were set
  - Filters out metrics with `numEvalsRequired <= 0`
  - Calls `evaluateAnswer()` function
  - **BUG**: Can fail or return unexpected results
  - Each evaluation = 1 API call

---

### `src/agent.ts` - Evaluation Result Handling

```typescript
// Lines 665-685
if (currentQuestion.trim() === question) {
  // disable coding for preventing answer degradation
  allowCoding = false;

  if (evaluation.pass) {
    diaryContext.push(`
At step ${step}, you took **answer** action and finally found the answer to the original question:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is good because:
${evaluation.think}

Your journey ends here. You have successfully answered the original question. Congratulations! 🎉
`);
    thisStep.isFinal = true;
    break
```

**Documentation**:
- **Line 665**: Check if we're answering the main question
  - Not a sub-question
  - Should only break when main question is answered

- **Line 667**: Disable coding action
  - Prevents LLM from "improving" the answer
  - Avoids answer degradation

- **Line 669**: **Check if evaluation passed**
  - **✅ GOOD PATH**: Break if evaluation passes
  - Adds success message to diary
  - Marks answer as final
  - **BREAKS LOOP** (line 685)

- **Lines 670-683**: Build success message
  - Tells LLM it succeeded
  - Provides feedback on why answer was good
  - Adds to diary context

- **Line 684**: Mark as final
  - `thisStep.isFinal = true`

- **Line 685**: **BREAK LOOP**
  - ✅ **GOOD**: Stops when main question is answered correctly

- **What if evaluation fails?**
  - Continues to line 686 (failure handling)

---

### `src/agent.ts` - Evaluation Failure Handling (THE DANGER ZONE)

```typescript
// Lines 686-747
} else {
  // lower numEvalsRequired for the failed evaluation and if numEvalsRequired is 0, remove it from the evaluation metrics
  evaluationMetrics[currentQuestion] = evaluationMetrics[currentQuestion].map(e => {
    if (e.type === evaluation.type) {
      e.numEvalsRequired--;
    }
    return e;
  }).filter(e => e.numEvalsRequired > 0);

  if (evaluation.type === 'strict' && evaluation.improvement_plan) {
    finalAnswerPIP.push(evaluation.improvement_plan);
  }

  if (evaluationMetrics[currentQuestion].length === 0) {
    // failed so many times, give up, route to beast mode
    thisStep.isFinal = false;
    break
  }

  diaryContext.push(`
At step ${step}, you took **answer** action but evaluator thinks it is not a good answer:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is bad because:
${evaluation.think}
`);
  // store the bad context and reset the diary context
  const errorAnalysis = await analyzeSteps(diaryContext, context, SchemaGen);

  allKnowledge.push({
    question: `
Why is the following answer bad for the question? Please reflect

<question>
${currentQuestion}
</question>

<answer>
${thisStep.answer}
</answer>
`,
    answer: `
${evaluation.think}

${errorAnalysis.recap}

${errorAnalysis.blame}

${errorAnalysis.improvement}
`,
    type: 'qa',
  })

  allowAnswer = false;  // disable answer action in the immediate next step
  diaryContext = [];
  step = 0;
}
```

**Documentation**:

- **Lines 688-693**: Decrease retry counts
  - Decrements `numEvalsRequired` for failed evaluation type
  - Removes metrics that reached 0 retries
  - **BUG**: Can create infinite loop if same evaluation keeps failing

- **Lines 695-697**: Add improvement plan to PIP
  - Only for 'strict' evaluations that provide improvement plan
  - PIP = Prompt Improvement Plan
  - Fed back to LLM in future attempts

- **Lines 699-703**: **Check if out of retries**
  - **✅ GOOD**: Breaks if no more evaluation metrics left
  - Marks answer as not final
  - **BREAKS LOOP** (line 702)
  - **PROBLEM**: Rarely reaches this point

- **Lines 705-716**: Add failure message to diary
  - Tells LLM its answer was rejected
  - Explains why it was bad

- **Line 718**: **Analyze failure**
  - Calls `analyzeSteps()` to understand what went wrong
  - **⚠️ EXPENSIVE**: Another LLM call

- **Lines 720-742**: Add failure analysis to knowledge
  - Creates Q&A item explaining the failure
  - Includes evaluation feedback
  - Includes error analysis (recap, blame, improvement)
  - **BUG**: This knowledge may not prevent same error

- **Line 744**: **⚠️ CRITICAL: Disable answer action**
  - `allowAnswer = false`
  - Prevents immediate retry with answer
  - **BUG**: Can cause other actions to fail

- **Line 745**: **⚠️ CRITICAL: Clear diary context**
  - `diaryContext = []`
  - Erases all previous steps from LLM's memory
  - **BUG**: Loses important context

- **Line 746**: **⚠️ CRITICAL: Reset step counter**
  - `step = 0`
  - Resets sub-step counter
  - **❌ BUG**: NO BREAK STATEMENT
  - **Loop continues from top of while**

**The Infinite Loop**:

```
Line 746: step = 0;
         ↓
         ↓ (no break!)
         ↓
Back to Line 518: while (tokens < budget)
         ↓
Line 520: step++;          // step becomes 1 again
Line 521: totalStep++;     // totalStep keeps increasing
         ↓
... generate action again ...
         ↓
Line 612: if (action === 'answer')
Line 616:   if (totalStep === 1 && !noDirectAnswer)
             // totalStep is now > 1, so this fails
         ↓
Line 669:   if (evaluation.pass)
             // Evaluation might fail again
         ↓
Line 686:   else { // evaluation failed
             ... decrease metrics ...
Line 699:     if (evaluationMetrics.length === 0)
                 break;  // Might not reach here
             else {
               ... reset state ...
Line 746:     step = 0;  // ← BACK TO TOP
             }
         ↓
         REPEATS FOREVER
```

---

## Summary of Issues

### Root Causes

1. **Single Exit Condition**
   - Only checks token budget
   - No max steps, timeout, or failure limits

2. **Complex State Management**
   - Multiple reset points (step = 0, diaryContext = [])
   - Unclear when to stop vs continue

3. **Evaluation Dependencies**
   - Loop termination depends on evaluation passing
   - Evaluation can fail indefinitely
   - No circuit breaker

4. **Parameter Sensitivity**
   - `noDirectAnswer` parameter changes behavior drastically
   - API mode allows infinite loops, CLI mode doesn't

### Impact

- **API Waste**: Can make 1000+ API calls per query
- **Rate Limits**: Hits daily limits in minutes
- **User Experience**: Never completes, confusing logs
- **Cost**: Expensive with paid LLM providers

### Recommended Fixes

```typescript
// Fix 1: Add max steps limit
const MAX_STEPS = 100;
while (tokens < budget && totalStep < MAX_STEPS) {

// Fix 2: Add timeout
const START_TIME = Date.now();
const MAX_DURATION = 5 * 60 * 1000; // 5 minutes
while (tokens < budget && (Date.now() - START_TIME) < MAX_DURATION) {

// Fix 3: Add consecutive failure limit
let consecutiveFailures = 0;
const MAX_FAILURES = 10;
// In evaluation failure handler:
consecutiveFailures++;
if (consecutiveFailures > MAX_FAILURES) {
  throw new Error('Too many consecutive failures');
}

// Fix 4: Always break on repeated answers
const recentAnswers = allContext.slice(-10).filter(s => s.action === 'answer');
if (recentAnswers.length >= 5) {
  const allSame = recentAnswers.every(a => a.answer === thisStep.answer);
  if (allSame) {
    thisStep.isFinal = true;
    break;
  }
}

// Fix 5: Remove noDirectAnswer or add safeguards
if (totalStep === 1 && !noDirectAnswer) {
  break;
}
// Add this:
if (totalStep === 1 && noDirectAnswer) {
  // Run evaluation once, then break regardless
  if (evaluationMetrics[currentQuestion].length === 0) {
    thisStep.isFinal = true;
    break;
  }
}
```

---

## Conclusion

This codebase has **critical infinite loop bugs** that can cause:
- Uncontrolled API consumption
- Rate limit exhaustion
- Query timeouts
- User confusion

**Both CLI and API modes use the same broken logic**, but API mode is more dangerous due to the `noDirectAnswer` parameter.

**Until fixed, use with extreme caution:**
- Low token budgets
- Timeout wrappers
- Active monitoring
- Never leave unattended
