// src/extractor/extractors/generic.ts
// Generic extractor for unknown hosts. Tries to find stream URLs in common
// formats. Only absolute URLs are accepted.

import { BaseExtractor } from '../base';
import { ExtractionResult, StreamFormat } from '../types';

const PATTERNS: RegExp[] = [
  /<source\s+src=["']([^"']+)["']/i,
  /var\s+source\s*=\s*['"]([^'"]+)['"]/i,
  /file:\s*["']([^"']+)["']/i,
  /"url":\s*["']([^"']+)["']/i,
  /src:\s*["']([^"']+)["']/i,
  /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.mp3[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.m4a[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.m4v[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.webm[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.ts[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.aac[^"'\s]*)/i,
  /(https?:\/\/[^"'\s]+\.wav[^"'\s]*)/i,
];

export async function extractGeneric(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, { ...headers, redirect: 'follow' } as any);

  for (const pattern of PATTERNS) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let streamUrl = match[1];
      // Only accept absolute URLs
      if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
        continue;
      }

      let format: StreamFormat = 'mp4';
      if (streamUrl.includes('.m3u8')) format = 'hls';
      else if (streamUrl.includes('.mp3')) format = 'mp3';
      else if (streamUrl.includes('.m4a')) format = 'm4a';
      else if (streamUrl.includes('.m4v')) format = 'm4v';
      else if (streamUrl.includes('.webm')) format = 'webm';
      else if (streamUrl.includes('.ts')) format = 'ts';
      else if (streamUrl.includes('.aac')) format = 'aac';
      else if (streamUrl.includes('.wav')) format = 'wav';

      return BaseExtractor.result(streamUrl, format, html, headers);
    }
  }

  throw new Error('Could not extract stream URL from generic host');
}