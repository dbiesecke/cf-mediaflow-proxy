// src/proxy/hls.ts - HLS and DASH manifest handling
// Ported from Rust proxy/hls and proxy/mpd modules

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

export class HlsProxy {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  /**
   * Handle HLS manifest and segment proxying
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response('Missing "d" parameter (destination URL)', { status: 400 });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response('Invalid URL scheme. Only HTTP/HTTPS is supported.', { status: 400 });
    }

    // Extract custom headers
    const customHeaders = UrlUtils.extractCustomHeaders(url);

    // Determine if this is a manifest or segment request
    const isManifest = pathname.includes('manifest.m3u8') || pathname.includes('.m3u8');
    const isSegment = pathname.match(/\.(ts|m4s|js|css)$/);

    try {
      const fetchOpts: RequestInit = {
        method: 'GET',
        headers: { ...customHeaders },
        cf: {
          cacheTtl: isSegment ? this.config.hls.segmentCacheTtl : 0,
          cacheEverything: isSegment,
        } as any,
      };

      const response = await fetch(destination, fetchOpts);
      Metrics.incrementRequest();

      if (!isManifest && !isSegment) {
        // Generic HLS segment
        return this.proxySegment(response, destination);
      }

      if (isManifest) {
        // Rewrite HLS manifest to use our proxy URLs
        const body = await response.clone().text();
        const rewritten = this.rewriteHlsManifest(body, url.origin);
        
        const headers = new Headers();
        headers.set('Content-Type', 'application/vnd.apple.mpegurl');
        headers.set('Cache-Control', `public, max-age=${this.config.hls.segmentCacheTtl}`);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Expose-Headers', 'Content-Length');
        headers.set('X-Manifest-Rewrite', 'true');

        return new Response(rewritten, {
          status: 200,
          headers,
        });
      }

      return this.proxySegment(response, destination);

    } catch (error: any) {
      Metrics.incrementError();
      console.error('HLS proxy error:', error);
      return new Response(`Proxy error: ${error.message}`, { status: 502 });
    }
  }

  /**
   * Rewrite HLS manifest to point segments through the proxy
   */
  private rewriteHlsManifest(manifest: string, proxyOrigin: string): string {
    const hlsConfig = this.config.hls;
    const lines = manifest.split('\n');
    const output: string[] = [];
    let inExt = false;
    let segmentCount = 0;
    const maxPrebuffer = hlsConfig.prebufferSegments;

    for (const line of lines) {
      // Don't rewrite absolute URLs (different origins)
      const isAbsolutePath = line.startsWith('#') === false && 
        (line.startsWith('http://') || line.startsWith('https://'));

      if (isAbsolutePath && !inExt) {
        // Rewrite relative and same-origin URLs to go through the proxy
        const segmentUrl = new URL(line, manifest);
        const proxyUrl = new URL('/proxy/hls/segment', proxyOrigin);
        proxyUrl.searchParams.set('d', segmentUrl.toString());
        
        output.push(proxyUrl.toString());
        segmentCount++;
        
        // Insert prebuffer comment
        if (segmentCount === maxPrebuffer) {
          output.push('#EXT-X-DISCONTINUITY');
        }
      } else {
        output.push(line);
      }
    }

    return output.join('\n');
  }

  /**
   * Proxy a media segment with caching
   */
  private async proxySegment(response: Response, sourceUrl: string): Promise<Response> {
    const headers = new Headers();
    
    const contentType = response.headers.get('content-type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    headers.set('Cache-Control', `public, max-age=${this.config.hls.segmentCacheTtl}`);
    headers.set('Access-Control-Allow-Origin', '*');

    // Stream the response
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  /**
   * Handle DASH (MPD) manifests - convert to HLS or proxy directly
   */
  async handleMpd(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response('Missing "d" parameter (destination URL)', { status: 400 });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response('Invalid URL scheme. Only HTTP/HTTPS is supported.', { status: 400 });
    }

    const customHeaders = UrlUtils.extractCustomHeaders(url);

    try {
      const response = await fetch(destination, {
        method: 'GET',
        headers: { ...customHeaders },
      });

      Metrics.incrementRequest();

      const body = await response.text();
      
      // Check if this is a DASH manifest
      if (body.includes('<MPD') || body.includes('<?xml')) {
        // Parse and process the MPD
        const processed = this.processMpdManifest(body, url.origin, destUrl.origin);
        
        // If remux to TS is enabled, we'd need server-side processing
        // In Workers, we return the manifest as-is or do HLS conversion
        const headers = new Headers();
        headers.set('Content-Type', 'application/dash+xml');
        headers.set('Cache-Control', `public, max-age=${this.config.mpd.liveInitCacheTtl}`);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Expose-Headers', 'Content-Length');
        
        return new Response(processed, {
          status: 200,
          headers,
        });
      }

      // Not an MPD manifest - pass through as stream
      return this.proxySegment(await fetch(destination, { headers: customHeaders }), destination);

    } catch (error: any) {
      Metrics.incrementError();
      console.error('MPD proxy error:', error);
      return new Response(`Proxy error: ${error.message}`, { status: 502 });
    }
  }

  /**
   * Process an MPD manifest:
   * - Rewrite segment URLs to go through proxy
   * - Handle period/adaptation set structure
   */
  private processMpdManifest(mpd: string, proxyOrigin: string, originalOrigin: string): string {
    // Regex-based MPD processing (simplified)
    // In production, use a proper XML parser
    
    // Rewrite all URLs in SegmentBase, SegmentList, and BaseURL elements
    const urlRegex = /\b(https?:\/\/[^\s"'<>"]+)/g;
    
    return mpd.replace(urlRegex, (match) => {
      try {
        const parsedUrl = new URL(match);
        // Only rewrite if pointing to the original origin
        if (parsedUrl.origin === originalOrigin) {
          const proxyUrl = new URL('/proxy/mpd/segment', proxyOrigin);
          proxyUrl.searchParams.set('d', match);
          return proxyUrl.toString();
        }
        return match;
      } catch {
        return match;
      }
    });
  }

  /**
   * Handle MPD segment proxying (fMP4 or MPEG-TS)
   */
  async handleMpdSegment(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response('Missing "d" parameter', { status: 400 });
    }

    const customHeaders = UrlUtils.extractCustomHeaders(url);

    try {
      const response = await fetch(destination, {
        method: 'GET',
        headers: { ...customHeaders },
        cf: {
          cacheTtl: this.config.hls.segmentCacheTtl,
          cacheEverything: true,
        } as any,
      });

      Metrics.incrementRequest();

      const headers = new Headers();
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        headers.set('Content-Type', contentType);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }

      headers.set('Cache-Control', `public, max-age=${this.config.hls.segmentCacheTtl}`);
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error: any) {
      Metrics.incrementError();
      return new Response(`Proxy error: ${error.message}`, { status: 502 });
    }
  }
}