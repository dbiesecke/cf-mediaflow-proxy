// src/proxy/stream.ts - Generic HTTP stream proxy
// Ported from Rust proxy/stream module

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

export class StreamProxy {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response('Missing "d" parameter (destination URL)', { status: 400 });
    }

    // Validate URL scheme
    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response('Invalid URL scheme. Only HTTP/HTTPS is supported.', { status: 400 });
    }

    // Check expiration
    const expires = UrlUtils.getUrlExpiration(destUrl);
    if (expires === null && url.searchParams.get('expires')) {
      return new Response('URL has expired', { status: 410 });
    }

    // Check IP access control
    const allowedIps = url.searchParams.get('allowed_ips')?.split(',') || [];
    if (allowedIps.length > 0 && !this.auth.checkIpAccess(request, allowedIps)) {
      return new Response('Access denied from this IP', { status: 403 });
    }

    // Extract custom headers
    const customHeaders = UrlUtils.extractCustomHeaders(url);

    // Determine HTTP method (stream proxy supports GET and HEAD)
    const method = url.searchParams.get('method') || request.method;
    
    // Build fetch options
    const fetchOpts: RequestInit = {
      method,
      headers: { ...customHeaders },
      redirect: this.config.proxy.followRedirects ? 'follow' : 'manual',
    };

    // Add range header if present
    const range = url.searchParams.get('range') || request.headers.get('Range');
    if (range) {
      (fetchOpts.headers as Record<string, string>)['Range'] = range;
    }

    try {
      const response = await fetch(destination, fetchOpts);
      Metrics.incrementRequest();

      // Stream the response back
      const headers = new Headers();
      
      // Copy content type
      const contentType = response.headers.get('content-type');
      if (contentType) {
        headers.set('Content-Type', contentType);
      }

      // Copy content length
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }

      // Copy accept ranges
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) {
        headers.set('Accept-Ranges', acceptRanges);
      }

      // Copy content range for streaming
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        headers.set('Content-Range', contentRange);
      }

      // ETag
      const etag = response.headers.get('etag');
      if (etag) {
        headers.set('ETag', etag);
      }

      // Last-Modified
      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        headers.set('Last-Modified', lastModified);
      }

      // Set cache headers for media content
      headers.set('Cache-Control', 'public, max-age=31536000');
      
      // CORS headers for web playback
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

      // Stream the body
      if (response.body) {
        // TransformStream for counting bytes
        const { readable, writable } = new TransformStream();
        const transform = new TransformStream({
          transform(chunk, controller) {
            Metrics.addBytes(chunk.byteLength || chunk.length);
            controller.enqueue(chunk);
          }
        });

        response.body.pipeTo(writable).catch(err => {
          if (err.name !== 'TypeError') {
            console.error('Stream error:', err);
            Metrics.incrementError();
          }
        });

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

    } catch (error: any) {
      Metrics.incrementError();
      console.error('Stream proxy error:', error);
      return new Response(`Proxy error: ${error.message}`, { status: 502 });
    }
  }

  /**
   * Handle filename-based route (/proxy/stream/<filename>)
   */
  async handleWithFilename(request: Request, filename: string): Promise<Response> {
    // Strip the filename from the path and continue
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const filenameIndex = pathParts.indexOf('stream');
    if (filenameIndex !== -1) {
      // Remove filename from path
      pathParts.splice(filenameIndex + 1, 1);
      url.pathname = pathParts.join('/');
    }
    const newRequest = new Request(url.toString(), request);
    return this.handle(newRequest);
  }

  // Placeholder for Acestream handling
  async handleAcestream(request: Request): Promise<Response> {
    return new Response('Acestream support is not available in the Worker version. Use a containerized deployment for P2P streaming.', {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Placeholder for Telegram handling
  async handleTelegram(request: Request): Promise<Response> {
    return new Response('Telegram MTProto proxy is not available in the Worker version. Use a containerized deployment for MTProto support.', {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}