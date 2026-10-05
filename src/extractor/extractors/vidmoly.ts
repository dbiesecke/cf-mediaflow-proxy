// src/extractor/extractors/vidmoly.ts
// Extractor for vidmoly hosts. Tries multiple patterns in priority order.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

const PATTERNS = [
  /<source\s+src=["']([^"']+)["']/i,
  /mp4:["']([^"']+)["']/i,
  /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i,
  /file["']?\s*:\s*["']([^"']+)["']/i,
  /sources["']?\s*:\s*["']([^"']+)["']/i,
];

export async function extractVidMoly(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  for (const pattern of PATTERNS) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return BaseExtractor.result(match[1], 'mp4', html);
    }
  }

  throw new Error('Could not extract stream URL from vidmoly');
}