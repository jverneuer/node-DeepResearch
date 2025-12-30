# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepResearch is a multi-step AI research agent that iteratively searches, reads, and reasons to find answers to complex queries. Unlike other "deep research" tools that generate long-form articles, this project focuses on finding concise, accurate answers through an iterative search-reason loop.

### Core Architecture

The main entry point is `src/agent.ts`, which implements the core research loop:

1. **Search** (`src/tools/jina-search.ts`, `brave-search.ts`, `serper-search.ts`) - Uses Jina Search API, Brave, or Serper for web search
2. **Read** (`src/tools/read.ts`) - Uses Jina Reader API to fetch and parse web content
3. **Reason** - Uses LLM (Gemini/OpenAI/Vertex) to decide next action via structured output

The agent loops through these actions until:
- Token budget is exceeded (enters "beast mode" for final answer)
- A definitive answer is found with proper references
- No new information can be gathered

### Key Components

- **`src/agent.ts`**: Main orchestration logic with the `getResponse()` function
- **`src/types.ts`**: All TypeScript type definitions (actions, evaluation types, API schemas)
- **`src/config.ts`**: Configuration management from `config.json` and environment variables
- **`src/app.ts`**: Express server providing OpenAI-compatible `/v1/chat/completions` endpoint
- **`src/server.ts`**: Server startup logic
- **`src/utils/schemas.ts`**: Zod schemas for LLM structured output (action types, evaluation)

### Tool Architecture

The agent uses "tools" - individual LLM calls with specific schemas:
- **Agent tools**: `agent`, `agentBeastMode` - main reasoning engine
- **Search tools**: `queryRewriter`, `serpCluster`, `jinaRerank`, `jinaDedup` - query optimization
- **Content tools**: `read` - webpage fetching
- **Evaluation tools**: `evaluator`, `errorAnalyzer` - quality control
- **Output tools**: `finalizer`, `reducer` - answer generation
- **Utility**: `coder` (code-sandbox) for data processing tasks

Each tool has its own model/temperature/maxTokens config in `config.json`.

### Action Types

The LLM chooses between five action types (defined in `src/utils/schemas.ts`):
- `search`: Generate search queries
- `visit`: Visit specific URLs to read content
- `answer`: Provide final or intermediate answer
- `reflect`: Break down problem into sub-questions
- `coding`: Request JavaScript code execution for data tasks

### State Management

- **Knowledge items**: Accumulated Q&A pairs stored as conversation history
- **URL tracking**: All discovered URLs with relevance scoring (`BoostedSearchSnippet`)
- **Token tracking**: `TokenTracker` monitors LLM usage across all tools
- **Action tracking**: `ActionTracker` records which actions were taken

### LLM Providers

Supports three providers via `LLM_PROVIDER` environment variable:
- `gemini` (default): Uses Google Gemini 2.5 Flash
- `openai`: Uses OpenAI models (or local LLMs via `OPENAI_BASE_URL`)
- `vertex`: Uses Google Vertex AI

Model selection is per-tool in `config.json`.

## Development Commands

### Running
```bash
# CLI mode - single query
npm run dev "your question here"

# Server mode - OpenAI-compatible API
npm run serve

# Server with authentication
npm run serve -- --secret=your_token
```

### Building & Testing
```bash
npm run build          # TypeScript compilation
npm test               # Run all tests (30s timeout)
npm run test:watch     # Jest watch mode
npm run test:docker    # Docker integration tests (5min timeout)
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix lint issues
```

### Utility Scripts
```bash
npm run search         # Test search functionality
npm run rewrite        # Test query rewriter
npm run ngram          # CLI tool for n-gram analysis
npm run eval           # Run batch evaluations
```

## Configuration

### Environment Variables
Required (set in `.env` or shell):
- `JINA_API_KEY`: Required - Get from https://jina.ai/reader (1M free tokens)
- `GEMINI_API_KEY`: Required if `LLM_PROVIDER=gemini` (default)
- `OPENAI_API_KEY`: Required if `LLM_PROVIDER=openai`
- `BRAVE_API_KEY`: Optional - for Brave search
- `SERPER_API_KEY`: Optional - for Serper search

Optional:
- `LLM_PROVIDER`: `gemini` | `openai` | `vertex` (default: `gemini`)
- `OPENAI_BASE_URL`: For local LLMs (e.g., `http://127.0.0.1:1234/v1`)
- `https_proxy`: Proxy URL for requests

### config.json

Central configuration file:
- `defaults.search_provider`: `jina` | `brave` | `serper` | `duck`
- `defaults.llm_provider`: Default LLM provider
- `models.{provider}.default`: Base model config (model, temperature, maxTokens)
- `models.{provider}.tools.{toolName}`: Per-tool overrides

## Testing

Tests are in `src/__tests__/` and `src/tools/__tests__/`.
- Uses Jest with ts-jest preset
- 30s default timeout, 5min for Docker tests
- Test files: `*.test.ts`

## Important Implementation Details

### Structured Output
The agent relies heavily on LLM structured output (JSON schema). Use `ObjectGeneratorSafe` from `src/utils/safe-generator.ts` for all LLM calls requiring structured output.

### URL Processing
- URLs are normalized, ranked, and deduplicated in `src/utils/url-tools.ts`
- Relevance scoring combines frequency, hostname, path, and reranking boosts
- `sortSelectURLs()` picks top candidates for visiting

### Citation & References
- Answers include footnote-style citations (`[^1]`, `[^2]`)
- `buildReferences()` in `src/tools/build-ref.ts` constructs citation objects
- `Reference` type includes exactQuote, URL, title, dateTime, relevanceScore

### Error Handling
- `errorAnalyzer` tool analyzes failed steps and suggests improvements
- `jsonrepair` library fixes malformed LLM JSON output
- Axios errors are caught and logged with context

### Streaming Responses
The server supports streaming responses (OpenAI-compatible):
- Thinking steps wrapped in `` special tokens
- Final answer streamed character-by-character
- URL citations sent as annotations

### Logging
Use logging utilities from `src/logging.ts`:
- `logInfo()`, `logError()`, `logDebug()`, `logWarning()`
- Avoid console.log/error directly (ESLint enforced)
