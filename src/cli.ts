#!/usr/bin/env node
/**
 * DeepResearch CLI
 *
 * Modern CLI using the refactored architecture
 */

import { ResearchAgent } from './agents/index.js';
import { OpenAIProvider } from './services/llm/LLMProvider.js';
import { JinaSearchProvider } from './services/search/SearchProvider.js';
import { WebContentReader } from './services/content/ContentReader.js';
import { StateManager } from './core/base/StateManager.js';
import { loadConfigFromEnv } from './core/types/schemas.js';

/**
 * Run research query
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const query = args[0];

  if (!query) {
    console.error('Usage: npm run dev "your research query"');
    process.exit(1);
  }

  try {
    // Load configuration
    const config = loadConfigFromEnv();

    // Create providers
    const llmProvider = new OpenAIProvider({
      name: 'openai',
      apiKey: config.llm.apiKey,
      ...(config.llm.baseUrl && { baseUrl: config.llm.baseUrl }),
      model: config.llm.model,
      timeout: config.llm.timeout,
    });

    const searchProvider = new JinaSearchProvider({
      name: 'jina',
      apiKey: config.search.apiKey,
      maxResults: config.search.maxResults,
      timeout: config.search.timeout,
    });

    const contentReader = new WebContentReader({
      timeout: 30000,
    });

    // Create state manager
    const stateManager = new StateManager({
      tokenBudget: config.limits.tokenBudget,
      maxKnowledge: 100,
      maxUrls: 50,
    });

    // Create agent
    const agent = new ResearchAgent(
      {
        tokenBudget: config.limits.tokenBudget,
        maxSteps: config.limits.maxSteps,
        maxDuration: config.limits.maxDuration,
        maxBadAttempts: config.limits.maxBadAttempts,
        timeout: 30000,
        enableTelemetry: config.features.enableTelemetry,
      },
      { llmProvider, searchProvider, contentReader },
      stateManager
    );

    console.log(`🔍 Researching: ${query}\n`);

    // Run research
    const result = await agent.research(query);

    // Display results
    console.log('✨ Research Complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Answer:\n${result.answer}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Metrics:`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`  Steps: ${result.steps}`);
    console.log(`  Searches: ${result.metrics.searchCount}`);
    console.log(`  Visits: ${result.metrics.visitCount}`);
    console.log(`  Errors: ${result.metrics.errorCount}`);

    if (result.references.length > 0) {
      console.log(`\n📚 References:`);
      result.references.forEach((ref, i) => {
        console.log(`  ${i + 1}. ${ref.url}`);
        console.log(`     "${ref.quote.slice(0, 100)}..."`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
