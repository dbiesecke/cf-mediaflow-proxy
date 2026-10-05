// src/extractor/extractors/mixdrop.ts
// Extractor for mixdrop / mixdropco / mixdropbz hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractMixdrop(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/(https:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
    html.match(/src:\s*["']([^"']+)["']/i) ||
    html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);

  if (match) {
    const streamUrl = match[1] || match[0];
    return BaseExtractor.result(streamUrl, undefined, html);
  }

  throw new Error('Could not extract stream URL from mixdrop');
}