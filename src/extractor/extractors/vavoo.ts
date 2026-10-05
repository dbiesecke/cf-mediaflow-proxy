// src/extractor/extractors/vavoo.ts
// Extractor for vavoo hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractVavoo(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/\.src\(['"]([^'"]+)['"]\)/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], 'hls', html, headers);
  }

  throw new Error('Could not extract stream URL from vavoo');
}