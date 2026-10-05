// src/extractor/extractors/streamtape.ts
// Extractor for streamtape hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractStreamtape(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
    html.match(/<source\s+src=["']([^"']+)["']/i);

  if (match) {
    return BaseExtractor.result(match[1], undefined, html);
  }

  throw new Error('Could not extract stream URL from streamtape');
}