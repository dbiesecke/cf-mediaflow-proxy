// src/extractor/extractors/uqload.ts
// Extractor for uqload hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractUqload(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'mp4', html);
  }

  throw new Error('Could not extract stream URL from uqload');
}