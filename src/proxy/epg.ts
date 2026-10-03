// src/proxy/epg.ts - XMLTV/EPG proxy with caching
// Ported from Rust proxy/epg module

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

export class EpgProxy {
  private config: ConfigManager;
  private auth: AuthManager;
  private cache: Map<string, CachedEpg>;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
    this.cache = new Map();
  }

  /**
   * Handle EPG proxy requests
   * Fetches XMLTV data from upstream and caches it with configurable TTL
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response('Missing "d" parameter (EPG URL)', { status: 400 });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response('Invalid URL scheme. Only HTTP/HTTPS is supported.', { status: 400 });
    }

    // Check cache
    const cacheKey = destination;
    const cacheTtl = this.config.epg.cacheTtl;
    const cached = this.cache.get(cacheKey);

    // Check custom cache TTL override
    const ttlOverride = url.searchParams.get('cache_ttl');
    const effectiveTtl = ttlOverride ? parseInt(ttlOverride, 10) : cacheTtl;

    if (cached && effectiveTtl > 0) {
      const age = Math.floor((Date.now() - cached.timestamp) / 1000);
      if (age < effectiveTtl) {
        // Return cached content
        const headers = new Headers();
        headers.set('Content-Type', 'application/xml');
        headers.set('X-EPG-Cache', 'HIT');
        headers.set('Cache-Control', `public, max-age=${effectiveTtl - age}`);
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(cached.data, {
          status: 200,
          headers,
        });
      }
    }

    // Extract custom headers
    const customHeaders = UrlUtils.extractCustomHeaders(url);

    try {
      const response = await fetch(destination, {
        method: 'GET',
        headers: {
          ...customHeaders,
          'Accept': 'application/xml,application/xmltv,application/octet-stream,*/*',
        },
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        } as any,
      });

      Metrics.incrementRequest();

      if (!response.ok) {
        Metrics.incrementError();
        return new Response(`Upstream error: ${response.status}`, {
          status: response.status,
          headers: { 'X-EPG-Cache': 'MISS' },
        });
      }

      const epgData = await response.text();

      // Store in cache
      if (effectiveTtl > 0) {
        this.cache.set(cacheKey, {
          data: epgData,
          timestamp: Date.now(),
        });
      }

      const remainingTtl = effectiveTtl;
      const headers = new Headers();
      headers.set('Content-Type', response.headers.get('content-type') || 'application/xml');
      headers.set('X-EPG-Cache', 'MISS');
      headers.set('Cache-Control', `public, max-age=${remainingTtl}`);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, X-EPG-Cache');

      return new Response(epgData, {
        status: 200,
        headers,
      });

    } catch (error: any) {
      Metrics.incrementError();
      console.error('EPG proxy error:', error);
      return new Response(`EPG fetch error: ${error.message}`, {
        status: 502,
        headers: { 'X-EPG-Cache': 'MISS' },
      });
    }
  }

  /**
   * Clean up old cache entries (call periodically if using Workers KV)
   */
  private cleanupCache(maxAgeSeconds: number): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if ((now - entry.timestamp) / 1000 > maxAgeSeconds) {
        this.cache.delete(key);
      }
    }
  }
}

interface CachedEpg {
  data: string;
  timestamp: number;
}