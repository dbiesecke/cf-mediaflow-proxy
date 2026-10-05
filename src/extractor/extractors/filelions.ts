// src/extractor/extractors/filelions.ts
// Extractor for filelions / filelionsonline hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractFilelions(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], undefined, html, headers);
  }

  throw new Error('Could not extract stream URL from filelions');
}