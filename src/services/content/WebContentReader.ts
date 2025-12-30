/**
 * Web Content Reader
 *
 * Implements content reader for web pages
 */

import type {
  ContentReader,
  ContentResult,
  ContentMetadata,
  ContentReadOptions,
} from './ContentReader.js';
import { extractMainContent, cleanText, calculateWordCount, calculateReadingTime, extractMetadata, truncateContent } from './ContentReader.js';

/**
 * Web Content Reader implementation
 */
export class WebContentReader implements ContentReader {
  private readonly timeout: number;

  constructor(options?: { readonly timeout?: number }) {
    this.timeout = options?.timeout || 30000;
  }

  /**
   * Read content from URL
   */
  async read(url: string, options?: ContentReadOptions): Promise<string> {
    const result = await this.readWithMetadata(url, options);
    return result.content;
  }

  /**
   * Read with metadata
   */
  async readWithMetadata(url: string, options?: ContentReadOptions): Promise<ContentResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DeepResearch/1.0)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Process content
      const maxLength = options?.maxLength || 50000;
      let content = extractMainContent(html);

      if (options?.extractMain !== false) {
        content = extractMainContent(content);
      }

      content = cleanText(content);

      if (content.length > maxLength) {
        content = truncateContent(content, maxLength);
      }

      // Extract metadata
      const metadata = extractMetadata(html, url);

      return {
        url,
        content,
        title: metadata.title,
        author: metadata.author,
        publishedDate: metadata.publishedDate,
        wordCount: calculateWordCount(content),
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Content read timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get metadata only
   */
  async getMetadata(url: string): Promise<ContentMetadata> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DeepResearch/1.0)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const metadata = extractMetadata(html, url);

      return metadata;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://example.com', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
