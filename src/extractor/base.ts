// src/extractor/base.ts - Shared utilities for host extractors
//
// Individual extractors live in src/extractor/extractors/*.ts as pure
// functions. This module provides the small amount of shared plumbing
// (HTML fetching, header augmentation, regex helpers) so each extractor
// stays focused on its host-specific parsing logic.

import { ExtractionResult, StreamFormat } from './types';

export class BaseExtractor {
  /**
   * Fetch a page and return its body as text.
   * Follows redirects by default — most video hosts rely on them.
   */
  static async fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    return response.text();
  }

  /**
   * Augment the request headers with any Referer/Authorization hints found
   * in the host page HTML. Some CDNs require the Referer to match the
   * video page, otherwise they 403 the stream.
   */
  static extractVideoHeaders(
    originalHeaders: Record<string, string>,
    html: string
  ): Record<string, string> {
    const headers: Record<string, string> = { ...originalHeaders };

    const refererMatch = html.match(/Referer\s*[:=]\s*["']([^"']+)["']/i);
    if (refererMatch) {
      headers['Referer'] = refererMatch[1];
    }

    const authMatch = html.match(/Authorization:\s*([^,\s]+)/i);
    if (authMatch) {
      headers['Authorization'] = authMatch[1];
    }

    return headers;
  }

  /**
   * Build an ExtractionResult, inferring the format from the URL extension
   * when one is not explicitly provided.
   *
   * `originalHeaders` are merged into the result's `headers` so extractors
   * that must forward the caller's headers (Referer, Authorization, etc.)
   * preserve them on the returned stream.
   */
  static result(
    streamUrl: string,
    format?: StreamFormat,
    html: string = '',
    originalHeaders: Record<string, string> = {},
    extra: Record<string, any> = {}
  ): ExtractionResult {
    const resolvedFormat = format ?? this.guessFormat(streamUrl);
    return {
      streamUrl,
      format: resolvedFormat,
      headers: html ? this.extractVideoHeaders(originalHeaders, html) : undefined,
      ...extra,
    };
  }

  /** Infer stream format from a URL's file extension. */
  static guessFormat(url: string): StreamFormat {
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.mpd')) return 'mpd';
    if (lower.includes('.mp3')) return 'mp3';
    if (lower.includes('.m4a')) return 'm4a';
    if (lower.includes('.m4v')) return 'm4v';
    if (lower.includes('.webm')) return 'webm';
    if (lower.includes('.ts')) return 'ts';
    if (lower.includes('.aac')) return 'aac';
    if (lower.includes('.wav')) return 'wav';
    return 'mp4';
  }

  /**
   * Normalise a stream URL: `//host/path` → `https://host/path`.
   * Some hosts emit protocol-relative URLs.
   */
  static normaliseUrl(raw: string): string {
    if (raw.startsWith('//')) {
      return 'https:' + raw;
    }
    return raw;
  }
}