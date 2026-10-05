// src/extractor/extractors/f16px.ts
// Extractor for f16px hosts. Some streams require an Authorization header
// embedded in the page HTML, which is merged with the caller's headers.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractF16px(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
    html.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);

  if (match) {
    const format = match[0].includes('.m3u8') ? 'hls' : 'mp4';
    return BaseExtractor.result(match[1], format as any, html, headers);
  }

  throw new Error('Could not extract stream URL from f16px');
}