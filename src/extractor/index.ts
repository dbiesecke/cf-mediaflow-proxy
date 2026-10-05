// src/extractor/index.ts - Video host extractors orchestrator
//
// Delegates to individual extractor files under src/extractor/extractors/.
// The public API (Extractors class) is unchanged so callers such as
// src/index.ts, src/mcp.ts and the tests continue to work.

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';
import { HlsProxy } from '../proxy/hls';
import { StreamProxy } from '../proxy/stream';
import { ExtractionResult } from './types';
import {
  HOST_REGISTRY,
  detectHost as detectHostFromRegistry,
  getSupportedHosts as getSupportedHostsFromRegistry,
  ExtractorFn,
} from './registry';

export class Extractors {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  /**
   * Handle extractor requests
   * Extracts direct stream URLs from video hosting services
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let host: string | undefined = url.searchParams.get('host')?.toLowerCase() || undefined;
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);
    const redirectStream = url.searchParams.get('redirect_stream') === 'true';

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Missing "d" parameter (video page URL)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auto-detect host from URL if not provided
    if (!host) {
      const detected = this.detectHost(destination);
      if (!detected) {
        return new Response(
          JSON.stringify({
            error: 'Could not auto-detect host. Please specify "host" parameter.',
            detected: false,
            supported_hosts: this.getSupportedHosts(),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      host = detected;
    }

    // Extract custom headers
    const customHeaders = UrlUtils.extractCustomHeaders(url);

    try {
      const result = await this.extract(host, destination, customHeaders);
      const { streamUrl, ...info } = result;

      Metrics.incrementRequest();

      // Handle redirect_stream parameter
      if (redirectStream && streamUrl) {
        return Response.redirect(streamUrl, 302);
      }

      // Generate proxy URL if stream was found
      if (streamUrl) {
        const proxyUrl = new URL('/proxy/stream', url.origin);
        proxyUrl.searchParams.set('d', streamUrl);
        info.proxy_url = proxyUrl.toString();

        // Add headers if any
        if (info.headers && typeof info.headers === 'object') {
          for (const [key, value] of Object.entries(info.headers)) {
            proxyUrl.searchParams.set(`h_${key.replace(/-/g, '_')}`, value as string);
          }
          info.proxy_url = proxyUrl.toString();
        }
      }

      return new Response(
        JSON.stringify({
          status: streamUrl ? 'success' : 'failed',
          host: host,
          stream_url: streamUrl,
          ...info,
          proxy_url: streamUrl
            ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(streamUrl)}`
            : undefined,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error: any) {
      Metrics.incrementError();
      return new Response(
        JSON.stringify({
          error: error.message,
          host,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Handle /resolve_redirect/extract endpoint
   * Resolves a redirect URL and extracts the stream from the final destination
   * Supports multiple redirects on a single page
   */
  async handleResolveRedirect(request: Request, url: URL): Promise<Response> {
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);
    const redirectStream = url.searchParams.get('redirect_stream') === 'true';
    const outputFormat = url.searchParams.get('output_format') || 'json'; // 'json' or 'm3u8'
    if (!['json', 'm3u8'].includes(outputFormat)) {
      return new Response('output_format must be json or m3u8', { status: 400 });
    }

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Missing "d" parameter (URL to resolve)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Permalinks resolve the source afresh on every playback request.
      if (url.searchParams.get('play') === 'true') {
        const denied = await this.auth.requireAuth(request);
        if (denied) return denied;
        const result = await this.resolveRedirectAndExtract(
          destination,
          UrlUtils.extractCustomHeaders(url)
        );
        if (!result.streamUrl) return new Response('No stream found', { status: 404 });
        const proxy = new URL(
          result.format === 'hls' ? '/proxy/hls/manifest.m3u8' : '/proxy/stream',
          url.origin
        );
        proxy.search = url.search;
        ['play', 'output_format', 'redirect_stream', 'host'].forEach(key =>
          proxy.searchParams.delete(key)
        );
        proxy.searchParams.set('d', result.streamUrl);
        for (const [key, value] of Object.entries(result.headers || {})) {
          proxy.searchParams.set('h_' + key.replace(/-/g, '_'), value as string);
        }
        const proxyRequest = new Request(proxy, request);
        const response =
          result.format === 'hls'
            ? await new HlsProxy(this.config, this.auth).handle(proxyRequest)
            : await new StreamProxy(this.config, this.auth).handle(proxyRequest);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(response.body, { status: response.status, headers });
      }
      // If the URL is a known redirect host, resolve and extract
      const host = this.detectHost(destination);
      if (host && (host === 'doodstream' || host === 'playmogo')) {
        const result = await this.resolveRedirectAndExtract(destination);
        return this.resolvedResponse(result, destination, url, outputFormat, redirectStream);
      }

      // Otherwise, fetch the page and extract all redirect links
      const response = await fetch(destination, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });
      const html = await response.text();

      // Find all redirect links
      const redirectLinks = this.findRedirectLinks(html, destination);

      if (redirectLinks.length === 0) {
        // No redirect links found, try to extract directly
        const result = await this.resolveRedirectAndExtract(destination);
        return this.resolvedResponse(result, destination, url, outputFormat, redirectStream);
      }

      // Resolve all redirect links and extract streams
      const results = [];
      for (const redirectLink of redirectLinks) {
        try {
          const result = await this.resolveRedirectAndExtract(redirectLink);
          if (result.streamUrl) {
            results.push({
              redirect_url: redirectLink,
              resolved_url: new URL(result.streamUrl).origin,
              stream_url: result.streamUrl,
              format: result.format,
              proxy_url: this.permalink(redirectLink, url),
              permalink_url: this.permalink(redirectLink, url),
            });
          }
        } catch {
          // Skip failed extractions
          continue;
        }
      }

      if (results.length === 0) {
        return new Response(
          JSON.stringify({
            status: 'failed',
            error: 'No streams found in any redirect links',
            redirect_links_found: redirectLinks.length,
            redirect_links: redirectLinks,
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (redirectStream) return Response.redirect(results[0].permalink_url, 302);

      // Only HLS sources are valid HLS master-playlist variants.
      if (outputFormat === 'm3u8') {
        const hls = results.filter((r: any) => r.format === 'hls');
        if (!hls.length)
          return new Response('No HLS streams available for M3U8 output', { status: 422 });
        const m3u8 = this.generateM3U8(hls);
        return new Response(m3u8, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        });
      }

      // Default: return JSON
      return new Response(
        JSON.stringify({
          status: 'success',
          original_url: destination,
          total_streams: results.length,
          streams: results,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        }
      );
    } catch (error: any) {
      Metrics.incrementError();
      return new Response(
        JSON.stringify({
          error: error.message,
          original_url: destination,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Handle /resolve endpoint
   * Combines all techniques: redirect resolution, host auto-detection, and stream extraction
   */
  async handleResolve(request: Request, url: URL): Promise<Response> {
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);
    const redirectStream = url.searchParams.get('redirect_stream') === 'true';

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Missing "d" parameter (URL to resolve)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Check if it's a redirect URL pattern
      const host = this.detectHost(destination);
      const isRedirectPattern =
        host === 'doodstream' || host === 'playmogo' || destination.includes('/redirect/');

      if (isRedirectPattern) {
        // Use redirect resolution with multi-stream support
        return this.handleResolveRedirect(request, url);
      }

      // Check if it's Pluto TV
      if (host === 'pluto' || destination.includes('pluto.tv')) {
        const result = await this.extractPluto(destination, { 'User-Agent': 'Mozilla/5.0' });

        if (redirectStream && result.streamUrl) {
          return Response.redirect(result.streamUrl, 302);
        }

        return new Response(
          JSON.stringify({
            status: result.streamUrl ? 'success' : 'failed',
            original_url: destination,
            stream_url: result.streamUrl,
            format: result.format,
            proxy_url: result.streamUrl
              ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`
              : undefined,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Auto-detect host and extract
      const autoHost = this.detectHost(destination);
      if (autoHost && autoHost !== 'generic') {
        const result = await this.extract(autoHost, destination, {
          'User-Agent': 'Mozilla/5.0',
        });

        if (redirectStream && result.streamUrl) {
          return Response.redirect(result.streamUrl, 302);
        }

        return new Response(
          JSON.stringify({
            status: result.streamUrl ? 'success' : 'failed',
            original_url: destination,
            host: autoHost,
            stream_url: result.streamUrl,
            format: result.format,
            proxy_url: result.streamUrl
              ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`
              : undefined,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Generic extraction
      const result = await this.extractGeneric(destination, { 'User-Agent': 'Mozilla/5.0' });

      if (redirectStream && result.streamUrl) {
        return Response.redirect(result.streamUrl, 302);
      }

      return new Response(
        JSON.stringify({
          status: result.streamUrl ? 'success' : 'failed',
          original_url: destination,
          stream_url: result.streamUrl,
          format: result.format,
          proxy_url: result.streamUrl
            ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`
            : undefined,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error: any) {
      Metrics.incrementError();
      return new Response(
        JSON.stringify({
          error: error.message,
          original_url: destination,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Resolve a redirect URL - follows redirects and returns the final URL.
   * Useful for sites like aniworld.to that redirect to streaming hosts.
   */
  async resolveRedirect(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<string> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        try {
          return new URL(location, url).toString();
        } catch {
          return location;
        }
      }
    }

    const finalResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      redirect: 'follow',
    });

    return finalResponse.url;
  }

  /**
   * Resolve a redirect URL and extract the stream from the final destination.
   */
  async resolveRedirectAndExtract(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<ExtractionResult> {
    const finalUrl = await this.resolveRedirect(url, headers);
    const host = this.detectHost(finalUrl);
    if (host) {
      return this.extract(host, finalUrl, headers);
    }
    return this.extractGeneric(finalUrl, headers);
  }

  /**
   * Auto-detect host from URL
   */
  detectHost(url: string): string | null {
    return detectHostFromRegistry(url);
  }

  /**
   * Get list of supported extractor hosts
   */
  getSupportedHosts(): string[] {
    return getSupportedHostsFromRegistry();
  }

  /**
   * Run extraction with a specific host.
   * Dispatches through the registry; doodstream receives a resolver so
   * iframe redirects can be followed.
   */
  async extract(
    host: string,
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const entry = HOST_REGISTRY[host];
    if (!entry) {
      throw new Error(`Unsupported host: ${host}`);
    }

    const fn = entry.fn;
    if (host === 'doodstream' || host === 'dood' || host === 'playmogo' || host === 'doodstream-not-working') {
      // Doodstream's iframe fallback needs the registry's dispatcher.
      const resolver = (h: string, u: string, h2: Record<string, string>) =>
        this.extract(h, u, h2);
      return fn(url, headers, {
        resolve: resolver,
        fallback: (u: string, h: Record<string, string>) => this.extractVidplay(u, h),
      });
    }

    return fn(url, headers);
  }

  // ----------------------------------------------------------------
  // Individual extractor passthroughs — kept so the class still
  // directly exposes each extractor (used by tests and MCP tools).
  // ----------------------------------------------------------------

  private async extractVidplay(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVidplay } = await import('./extractors/vidplay');
    return extractVidplay(url, headers);
  }

  private async extractDoodstream(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractDoodstream } = await import('./extractors/doodstream');
    const resolver = (h: string, u: string, h2: Record<string, string>) =>
      this.extract(h, u, h2);
    return extractDoodstream(url, headers, { resolve: resolver, fallback: (u, h) => this.extractVidplay(u, h) });
  }

  private async extractMixdrop(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractMixdrop } = await import('./extractors/mixdrop');
    return extractMixdrop(url, headers);
  }

  private async extractFilemoon(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractFilemoon } = await import('./extractors/filemoon');
    return extractFilemoon(url, headers);
  }

  private async extractStreamtape(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractStreamtape } = await import('./extractors/streamtape');
    return extractStreamtape(url, headers);
  }

  private async extractVidoza(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVidoza } = await import('./extractors/vidoza');
    return extractVidoza(url, headers);
  }

  private async extractVoe(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVoe } = await import('./extractors/voe');
    return extractVoe(url, headers);
  }

  private async extractCity(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractCity } = await import('./extractors/city');
    return extractCity(url, headers);
  }

  private async extractLulustream(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractLulustream } = await import('./extractors/lulustream');
    return extractLulustream(url, headers);
  }

  private async extractMaxstream(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractMaxstream } = await import('./extractors/maxstream');
    return extractMaxstream(url, headers);
  }

  private async extractUqload(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractUqload } = await import('./extractors/uqload');
    return extractUqload(url, headers);
  }

  private async extractF16px(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractF16px } = await import('./extractors/f16px');
    return extractF16px(url, headers);
  }

  private async extractFastream(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractFastream } = await import('./extractors/fastream');
    return extractFastream(url, headers);
  }

  private async extractOkru(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractOkru } = await import('./extractors/okru');
    return extractOkru(url, headers);
  }

  private async extractVidfast(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVidfast } = await import('./extractors/vidfast');
    return extractVidfast(url, headers);
  }

  private async extractFilelions(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractFilelions } = await import('./extractors/filelions');
    return extractFilelions(url, headers);
  }

  private async extractSportsOnline(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractSportsOnline } = await import('./extractors/sportsonline');
    return extractSportsOnline(url, headers);
  }

  private async extractVidMoly(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVidMoly } = await import('./extractors/vidmoly');
    return extractVidMoly(url, headers);
  }

  private async extractVavoo(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVavoo } = await import('./extractors/vavoo');
    return extractVavoo(url, headers);
  }

  private async extractStreamwish(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractStreamwish } = await import('./extractors/streamwish');
    return extractStreamwish(url, headers);
  }

  private async extractVixCloud(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractVixCloud } = await import('./extractors/vixcloud');
    return extractVixCloud(url, headers);
  }

  private async extractLiveTv(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractLiveTv } = await import('./extractors/livetv');
    return extractLiveTv(url, headers);
  }

  private async extractSuperVideo(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractSuperVideo } = await import('./extractors/supervideo');
    return extractSuperVideo(url, headers);
  }

  private async extractGupload(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractGeneric } = await import('./extractors/generic');
    return extractGeneric(url, headers);
  }

  private async extractPluto(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractPluto } = await import('./extractors/pluto');
    return extractPluto(url, headers);
  }

  private async extractGeneric(
    url: string,
    headers: Record<string, string>
  ): Promise<ExtractionResult> {
    const { extractGeneric } = await import('./extractors/generic');
    return extractGeneric(url, headers);
  }

  // ----------------------------------------------------------------
  // Shared helpers (mirrored from the original monolith)
  // ----------------------------------------------------------------

  /** Generate M3U8 playlist with multiple stream variants */
  private generateM3U8(results: Array<{ permalink_url: string }>): string {
    const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3', ''];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=2000000,NAME="Source ${i + 1}"`);
      lines.push(result.permalink_url);
      lines.push('');
    }

    return lines.join('\n');
  }

  private permalink(source: string, requestUrl: URL): string {
    const url = new URL('/resolve_redirect/extract', requestUrl.origin);
    url.search = requestUrl.search;
    ['redirect_stream', 'host'].forEach(key => url.searchParams.delete(key));
    url.searchParams.set('d', source);
    url.searchParams.set('play', 'true');
    url.searchParams.set('output_format', 'm3u8');
    return url.href;
  }

  private resolvedResponse(
    result: ExtractionResult,
    source: string,
    url: URL,
    format: string,
    redirect: boolean
  ): Response {
    const permalink = result.streamUrl ? this.permalink(source, url) : undefined;
    if (redirect && permalink) return Response.redirect(permalink, 302);
    if (format === 'm3u8') {
      if (!permalink) return new Response('No stream found', { status: 404 });
      if (result.format !== 'hls')
        return new Response(
          'M3U8 output requires an HLS source; use the playback permalink for this format.',
          { status: 422 }
        );
      return new Response(this.generateM3U8([{ permalink_url: permalink }]), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    }
    return new Response(
      JSON.stringify({
        status: result.streamUrl ? 'success' : 'failed',
        original_url: source,
        resolved_url: result.streamUrl ? new URL(result.streamUrl).origin : null,
        stream_url: result.streamUrl,
        format: result.format,
        proxy_url: permalink,
        permalink_url: permalink,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  /** Find all redirect links in HTML */
  private findRedirectLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const base = new URL(baseUrl);

    const redirectMatches = html.matchAll(/\/redirect\/(\d+)/g);
    for (const match of redirectMatches) {
      const id = match[1];
      links.push(`${base.origin}/redirect/${id}`);
    }

    const aniworldMatches = html.matchAll(/https?:\/\/aniworld\.to\/redirect\/(\d+)/g);
    for (const match of aniworldMatches) {
      if (!links.includes(match[0])) {
        links.push(match[0]);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }
}