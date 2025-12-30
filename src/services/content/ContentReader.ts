/**
 * Content Reader - Abstract interface for reading web content
 *
 * Supports multiple content sources and processing strategies
 * with unified interface and error handling
 */

import { z } from 'zod';

/**
 * Content read options
 */
export interface ContentReadOptions {
  readonly timeout?: number;
  readonly maxLength?: number;
  readonly extractMain?: boolean;
  readonly removeScripts?: boolean;
  readonly removeStyles?: boolean;
}

/**
 * Content result
 */
export interface ContentResult {
  readonly url: string;
  readonly content: string;
  readonly title?: string;
  readonly author?: string;
  readonly publishedDate?: Date;
  readonly wordCount: number;
  readonly timestamp: Date;
}

/**
 * Content metadata
 */
export interface ContentMetadata {
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly keywords?: ReadonlyArray<string>;
  readonly author?: string;
  readonly publishedDate?: Date;
  readonly modifiedDate?: Date;
  readonly wordCount?: number;
  readonly readingTime?: number; // minutes
}

/**
 * Content Reader interface
 */
export interface ContentReader {
  /**
   * Read content from URL
   */
  read(url: string, options?: ContentReadOptions): Promise<string>;

  /**
   * Read with metadata
   */
  readWithMetadata(url: string, options?: ContentReadOptions): Promise<ContentResult>;

  /**
   * Get metadata only
   */
  getMetadata(url: string): Promise<ContentMetadata>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Validation schemas
 */
export const ContentReadOptionsSchema = z
  .object({
    timeout: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    extractMain: z.boolean().optional(),
    removeScripts: z.boolean().optional(),
    removeStyles: z.boolean().optional(),
  })
  .strict();

export const ContentResultSchema = z.object({
  url: z.string().url(),
  content: z.string(),
  title: z.string().optional(),
  author: z.string().optional(),
  publishedDate: z.date().optional(),
  wordCount: z.number().int().nonnegative(),
  timestamp: z.date(),
});

export const ContentMetadataSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  publishedDate: z.date().optional(),
  modifiedDate: z.date().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  readingTime: z.number().int().nonnegative().optional(),
});

export type ValidatedContentReadOptions = z.infer<typeof ContentReadOptionsSchema>;
export type ValidatedContentResult = z.infer<typeof ContentResultSchema>;
export type ValidatedContentMetadata = z.infer<typeof ContentMetadataSchema>;

/**
 * Validate content read options
 */
export function validateContentReadOptions(data: unknown): ValidatedContentReadOptions {
  return ContentReadOptionsSchema.parse(data);
}

/**
 * Validate content result
 */
export function validateContentResult(data: unknown): ValidatedContentResult {
  return ContentResultSchema.parse(data);
}

/**
 * Validate content metadata
 */
export function validateContentMetadata(data: unknown): ValidatedContentMetadata {
  return ContentMetadataSchema.parse(data);
}

/**
 * Calculate word count
 */
export function calculateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Calculate reading time (average 200 words per minute)
 */
export function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 200);
}

/**
 * Extract main content (simple heuristic-based extraction)
 */
export function extractMainContent(html: string): string {
  // Remove scripts
  let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove styles
  content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove common non-content tags
  content = content.replace(/<(?:header|footer|nav|aside|sidebar|ad|advertisement)[^>]*>.*?<\/\1>/gis, '');

  // Extract paragraphs
  const paragraphs = content.match(/<p[^>]*>(.*?)<\/p>/gis) || [];

  // Extract text from paragraphs
  const text = paragraphs
    .map((p) => p.replace(/<[^>]+>/g, ' ').trim())
    .filter((text) => text.length > 50)
    .join('\n\n');

  return text;
}

/**
 * Remove HTML tags
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate content to max length
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Truncate at word boundary
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return truncated.slice(0, lastSpace) + '...';
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Process content pipeline
 */
export function processContent(
  content: string,
  options?: {
    stripHtml?: boolean;
    extractMain?: boolean;
    maxLength?: number;
    clean?: boolean;
  }
): string {
  let processed = content;

  if (options?.extractMain) {
    processed = extractMainContent(processed);
  }

  if (options?.stripHtml) {
    processed = stripHtml(processed);
  }

  if (options?.clean !== false) {
    processed = cleanText(processed);
  }

  if (options?.maxLength && processed.length > options.maxLength) {
    processed = truncateContent(processed, options.maxLength);
  }

  return processed;
}

/**
 * Extract metadata from HTML
 */
export function extractMetadata(html: string, url: string): ContentMetadata {
  const metadata: ContentMetadata = {
    url,
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  // Extract keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["'](.*?)["']/i);
  if (keywordsMatch) {
    metadata.keywords = keywordsMatch[1].split(',').map((k) => k.trim());
  }

  // Extract author
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["'](.*?)["']/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }

  // Extract published date
  const dateMatch = html.match(
    /<meta[^>]*(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["'][^>]*content=["'](.*?)["']/i
  );
  if (dateMatch) {
    metadata.publishedDate = new Date(dateMatch[1]);
  }

  return metadata;
}
