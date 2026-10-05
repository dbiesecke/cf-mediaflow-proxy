// src/extractor/extractors/doodstream.ts
// Extractor for doodstream / dood / playmogo hosts.
// Tries the dsverify/dl-https JS patterns, then falls back to a generic
// mp4/m3u8 regex, and finally to an iframe redirect that may point at
// another known extractor. The iframe fallback needs the registry's
// `extract` dispatcher, so it is injected via the `options` argument.

import { BaseExtractor } from '../base';
import { ExtractionResult } from '../types';
import { extractVidplay } from './vidplay';

export interface DoodstreamOptions {
  /** Registry dispatcher used to follow iframe redirects to other hosts. */
  resolve?: (host: string, url: string, headers: Record<string, string>) => Promise<ExtractionResult>;
  /** Fallback extractor used when the iframe host is unknown. */
  fallback?: (url: string, headers: Record<string, string>) => Promise<ExtractionResult>;
}

export async function extractDoodstream(
  url: string,
  headers: Record<string, string> = {},
  options: DoodstreamOptions = {}
): Promise<ExtractionResult> {
  const html = await BaseExtractor.fetchHtml(url, headers);

  const match =
    html.match(/dsverify\(['"]([^'"]+)['"]/) ||
    html.match(/dl-https\(['"]([^'"]+)['"]/) ||
    html.match(/(https?:\/\/[^"'\s]+\.(mp4|m3u8)[^"'\s]*)/i);

  if (match) {
    let streamUrl = BaseExtractor.normaliseUrl(match[1]);
    const format = match[0].includes('.m3u8') ? 'hls' : 'mp4';
    return BaseExtractor.result(streamUrl, format as any, html, headers);
  }

  // Try iframe redirect — may point at another known extractor
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    const iframeUrl = BaseExtractor.normaliseUrl(iframeMatch[1]);
    const resolver = options.resolve;
    if (resolver) {
      // Detect the host from the iframe URL and dispatch through the registry.
      const { detectHost } = await import('../registry');
      const autoHost = detectHost(iframeUrl);
      if (autoHost) {
        return resolver(autoHost, iframeUrl, { ...headers, Referer: url });
      }
    }
    const fallback = options.fallback ?? extractVidplay;
    return fallback(iframeUrl, { ...headers, Referer: url });
  }

  throw new Error('Could not extract stream URL from doodstream');
}