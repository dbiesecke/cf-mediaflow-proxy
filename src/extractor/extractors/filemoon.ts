// src/extractor/extractors/filemoon.ts
// Extractor for filemoon / filemoon-not-working / bysezejataos hosts.
// Tries the API endpoint first, then falls back to HTML extraction.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';

export async function extractFilemoon(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  // Try the API endpoint first (bysezejataos.com)
  const apiUrl = url.replace('/d/', '/api/videos/').replace('/e/', '/api/videos/');
  try {
    const response = await fetch(apiUrl, { headers });
    const data: any = await response.json();

    const streamUrl = data?.playback?.stream_url || data?.playback?.url;
    if (streamUrl) {
      return BaseExtractor.result(streamUrl, undefined, '', headers);
    }

    const directUrl = data?.playback?.url || data?.video?.stream_url || data?.url;
    if (directUrl) {
      return BaseExtractor.result(directUrl, undefined, '', headers);
    }
  } catch {
    // API call failed, try HTML extraction
  }

  // HTML extraction
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
    html.match(/<source\s+src=["']([^"']+)["']/i) ||
    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

  if (match) {
    return BaseExtractor.result(match[1], undefined, html, headers);
  }

  throw new Error('Could not extract stream URL from filemoon');
}