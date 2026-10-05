// src/extractor/extractors/voe.ts
// Extractor for voe / voeplay / jeremyparticipantanything hosts.
// Tries multiple extraction patterns in priority order.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

const PATTERNS = [
  /var\s+source\s*=\s*['"]([^'"]+)['"]/i,
  /id="[^"]*player[^"]*"[^>]*\s+src=["']([^"']+)["']/i,
  /<source\s+src=["']([^"']+)["']/i,
  /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i,
  /file:\s*["']([^"']+)["']/i,
  /"url":\s*["']([^"']+)["']/i,
];

export async function extractVoe(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, { ...headers, redirect: 'follow' } as any);

  for (const pattern of PATTERNS) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return BaseExtractor.result(match[1], 'mp4', html);
    }
  }

  // Try to extract from JavaScript variables
  const jsMatch = html.match(/(?:sources|files|files?)\s*[:=]\s*["']([^"']+)["']/i);
  if (jsMatch) {
    return BaseExtractor.result(jsMatch[1], 'mp4', html);
  }

  throw new Error('Could not extract stream URL from voe');
}