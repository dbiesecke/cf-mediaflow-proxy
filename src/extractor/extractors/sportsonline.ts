// src/extractor/extractors/sportsonline.ts
// Extractor for sportsonline hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractSportsOnline(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) ||
    html.match(/<source\s+src=["']([^"']+)["']/i);

  if (match) {
    return BaseExtractor.result(match[1], 'hls', html, headers);
  }

  throw new Error('Could not extract stream URL from sportsonline');
}