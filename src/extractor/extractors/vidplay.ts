// src/extractor/extractors/vidplay.ts
// Extractor for vidplay / turbovidplay / videovip hosts.
// Tries an m3u8 URL first, then falls back to a direct mp4 URL.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractVidplay(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
  if (m3u8Match) {
    return BaseExtractor.result(m3u8Match[1], 'hls', html, headers);
  }

  const mp4Match =
    html.match(/source\s*src=["']([^"']+\.mp4[^"']*)["']/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
  if (mp4Match) {
    return BaseExtractor.result(mp4Match[1], 'mp4', html, headers);
  }

  throw new Error('Could not extract stream URL from vidplay');
}