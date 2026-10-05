// src/extractor/extractors/vidoza.ts
// Extractor for vidoza hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractVidoza(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/<source\s+src=["']([^"']+)["']/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'mp4', html);
  }

  throw new Error('Could not extract stream URL from vidoza');
}