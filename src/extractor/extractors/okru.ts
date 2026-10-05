// src/extractor/extractors/okru.ts
// Extractor for ok.ru / odnoklassniki.ru hosts.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractOkru(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const jsonMatch = html.match(/"url":"([^"]+)"/i);
  const mp4Match = jsonMatch || html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (mp4Match) {
    const streamUrl = decodeURIComponent(mp4Match[1] || mp4Match[0]);
    return BaseExtractor.result(streamUrl, 'mp4', html, headers);
  }

  throw new Error('Could not extract stream URL from okru');
}