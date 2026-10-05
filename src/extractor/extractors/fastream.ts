// src/extractor/extractors/fastream.ts
// Extractor for fastream hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractFastream(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'hls', html, headers);
  }

  throw new Error('Could not extract stream URL from fastream');
}