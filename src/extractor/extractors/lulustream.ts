// src/extractor/extractors/lulustream.ts
// Extractor for lulustream hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractLulustream(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'mp4', html);
  }

  throw new Error('Could not extract stream URL from lulustream');
}