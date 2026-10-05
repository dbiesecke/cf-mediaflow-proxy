// src/extractor/extractors/supervideo.ts
// Extractor for supervideo hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractSuperVideo(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/<source\s+src=["']([^"']+)["']/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'mp4', html, headers);
  }

  throw new Error('Could not extract stream URL from supervideo');
}