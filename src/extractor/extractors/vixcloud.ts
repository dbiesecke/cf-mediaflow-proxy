// src/extractor/extractors/vixcloud.ts
// Extractor for vixcloud / vixcloud6 hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractVixCloud(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) ||
    html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);

  if (match) {
    return BaseExtractor.result(match[1], 'hls', html, headers);
  }

  throw new Error('Could not extract stream URL from vixcloud');
}