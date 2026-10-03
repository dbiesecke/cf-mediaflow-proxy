// src/extractor/index.ts - Video host extractors
// Ported from Rust extractor module
// Implements stream URL extraction from 24 video hosting services

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

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
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Auto-detect host from URL if not provided
    if (!host) {
      const detected = this.detectHost(destination);
      if (!detected) {
        return new Response(JSON.stringify({
          error: 'Could not auto-detect host. Please specify "host" parameter.',
          detected: false,
          supported_hosts: this.getSupportedHosts()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      host = detected;
    }

    // Extract custom headers
    const customHeaders = UrlUtils.extractCustomHeaders(url);

    try {
      let streamUrl: string | null = null;
      let info: Record<string, any> = {};

      switch (host) {
        case 'city':
          ({ streamUrl, ...info } = await this.extractCity(destination, customHeaders));
          break;
        case 'lulustream':
          ({ streamUrl, ...info } = await this.extractLulustream(destination, customHeaders));
          break;
        case 'turbovidplay':
        case 'vidplay':
        case 'videovip':
          ({ streamUrl, ...info } = await this.extractVidplay(destination, customHeaders));
          break;
        case 'doodstream':
        case 'dood':
        case 'playmogo':
          ({ streamUrl, ...info } = await this.extractDoodstream(destination, customHeaders));
          break;
        case 'maxstream':
          ({ streamUrl, ...info } = await this.extractMaxstream(destination, customHeaders));
          break;
        case 'uqload':
          ({ streamUrl, ...info } = await this.extractUqload(destination, customHeaders));
          break;
        case 'f16px':
          ({ streamUrl, ...info } = await this.extractF16px(destination, customHeaders));
          break;
        case 'mixdrop':
        case 'mixdropco':
        case 'mixdropbz':
          ({ streamUrl, ...info } = await this.extractMixdrop(destination, customHeaders));
          break;
        case 'vavoo':
          ({ streamUrl, ...info } = await this.extractVavoo(destination, customHeaders));
          break;
        case 'fastream':
          ({ streamUrl, ...info } = await this.extractFastream(destination, customHeaders));
          break;
        case 'okru':
          ({ streamUrl, ...info } = await this.extractOkru(destination, customHeaders));
          break;
        case 'vidfast':
          ({ streamUrl, ...info } = await this.extractVidfast(destination, customHeaders));
          break;
        case 'filelions':
        case 'filelionsonline':
          ({ streamUrl, ...info } = await this.extractFilelions(destination, customHeaders));
          break;
        case 'sportsonline':
          ({ streamUrl, ...info } = await this.extractSportsOnline(destination, customHeaders));
          break;
        case 'vidmoly':
          ({ streamUrl, ...info } = await this.extractVidMoly(destination, customHeaders));
          break;
case 'filemoon':
      case 'filemoon-not-working':
      case 'bysezejataos':
        ({ streamUrl, ...info } = await this.extractFilemoon(destination, customHeaders));
        break;
      case 'streamtape':
        ({ streamUrl, ...info } = await this.extractStreamtape(destination, customHeaders));
        break;
      case 'vidoza':
        ({ streamUrl, ...info } = await this.extractVidoza(destination, customHeaders));
        break;
      case 'gupload':
        ({ streamUrl, ...info } = await this.extractGupload(destination, customHeaders));
        break;
      case 'streamwish':
      case 'streamwishonline':
      case 'asnwave':
        ({ streamUrl, ...info } = await this.extractStreamwish(destination, customHeaders));
        break;
      case 'vixcloud':
      case 'vixcloud6':
        ({ streamUrl, ...info } = await this.extractVixCloud(destination, customHeaders));
        break;
      case 'livetv':
        ({ streamUrl, ...info } = await this.extractLiveTv(destination, customHeaders));
        break;
      case 'supervideo':
        ({ streamUrl, ...info } = await this.extractSuperVideo(destination, customHeaders));
        break;
      case 'voe':
      case 'voeplay':
      case 'jeremyparticipantanything':
        ({ streamUrl, ...info } = await this.extractVoe(destination, customHeaders));
        break;
      case 'generic':
        ({ streamUrl, ...info } = await this.extractGeneric(destination, customHeaders));
        break;
      default:
        return new Response(JSON.stringify({
          error: `Unsupported host: ${host}`,
          supported_hosts: this.getSupportedHosts()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

      return new Response(JSON.stringify({
        status: streamUrl ? 'success' : 'failed',
        host: host,
        stream_url: streamUrl,
        ...info,
        proxy_url: streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(streamUrl)}` : undefined,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error: any) {
      Metrics.incrementError();
      return new Response(JSON.stringify({
        error: error.message,
        host
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
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

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Missing "d" parameter (URL to resolve)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // If the URL is a known redirect host, resolve and extract
      const host = this.detectHost(destination);
      if (host && (host === 'doodstream' || host === 'playmogo')) {
        const result = await this.resolveRedirectAndExtract(destination);

        if (redirectStream && result.streamUrl) {
          return Response.redirect(result.streamUrl, 302);
        }

        return new Response(JSON.stringify({
          status: result.streamUrl ? 'success' : 'failed',
          original_url: destination,
          resolved_url: result.streamUrl ? new URL(result.streamUrl).origin : null,
          stream_url: result.streamUrl,
          format: result.format,
          proxy_url: result.streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}` : undefined,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Otherwise, fetch the page and extract all redirect links
      const response = await fetch(destination, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      const html = await response.text();

      // Find all redirect links
      const redirectLinks = this.findRedirectLinks(html, destination);

      if (redirectLinks.length === 0) {
        // No redirect links found, try to extract directly
        const result = await this.resolveRedirectAndExtract(destination);

        if (redirectStream && result.streamUrl) {
          return Response.redirect(result.streamUrl, 302);
        }

        return new Response(JSON.stringify({
          status: result.streamUrl ? 'success' : 'failed',
          original_url: destination,
          resolved_url: result.streamUrl ? new URL(result.streamUrl).origin : null,
          stream_url: result.streamUrl,
          format: result.format,
          proxy_url: result.streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}` : undefined,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
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
              proxy_url: `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`,
            });
          }
        } catch (e) {
          // Skip failed extractions
          continue;
        }
      }

      if (results.length === 0) {
        return new Response(JSON.stringify({
          status: 'failed',
          error: 'No streams found in any redirect links',
          redirect_links_found: redirectLinks.length,
          redirect_links: redirectLinks,
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // If output_format is m3u8, generate a playlist with all streams as variants
      if (outputFormat === 'm3u8') {
        const m3u8 = this.generateM3U8(results, url.hostname);
        return new Response(m3u8, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Default: return JSON
      return new Response(JSON.stringify({
        status: 'success',
        original_url: destination,
        total_streams: results.length,
        streams: results,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error: any) {
      Metrics.incrementError();
      return new Response(JSON.stringify({
        error: error.message,
        original_url: destination
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate M3U8 playlist with multiple stream variants
   * Each stream is a fallback option - if one fails, the next is tried
   */
  private generateM3U8(results: Array<{ stream_url: string; format: string; proxy_url?: string }>, hostname: string): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `#EXT-X-TITLE:MediaFlow Proxy - ${results.length} streams`,
      '',
    ];

    // Add each stream as a variant with fallback
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const proxyUrl = result.proxy_url || `https://${hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`;
      const bandwidth = result.format === 'hls' ? 2000000 : (result.format === 'mp4' ? 4000000 : 1000000);
      const resolution = result.format === 'hls' ? '1920x1080' : (result.format === 'mp4' ? '1920x1080' : '1280x720');

      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},NAME="Stream ${i + 1} (${result.format.toUpperCase()})"`);
      lines.push(proxyUrl);
      lines.push('');
    }

    // Add fallback markers
    lines.push('#EXT-X-FALLBACK:Stream 1');
    lines.push(`#EXT-X-ENDLIST`);

    return lines.join('\n');
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
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const destUrl = new URL(destination);
    if (!['http:', 'https:'].includes(destUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid URL scheme' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Check if it's a redirect URL pattern
      const host = this.detectHost(destination);
      const isRedirectPattern = host === 'doodstream' || host === 'playmogo' || destination.includes('/redirect/');

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

        return new Response(JSON.stringify({
          status: result.streamUrl ? 'success' : 'failed',
          original_url: destination,
          stream_url: result.streamUrl,
          format: result.format,
          proxy_url: result.streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}` : undefined,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Auto-detect host and extract
      const autoHost = this.detectHost(destination);
      if (autoHost && autoHost !== 'generic') {
        const result = await this.extract(autoHost, destination, { 'User-Agent': 'Mozilla/5.0' });

        if (redirectStream && result.streamUrl) {
          return Response.redirect(result.streamUrl, 302);
        }

        return new Response(JSON.stringify({
          status: result.streamUrl ? 'success' : 'failed',
          original_url: destination,
          host: autoHost,
          stream_url: result.streamUrl,
          format: result.format,
          proxy_url: result.streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}` : undefined,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Generic extraction
      const result = await this.extractGeneric(destination, { 'User-Agent': 'Mozilla/5.0' });

      if (redirectStream && result.streamUrl) {
        return Response.redirect(result.streamUrl, 302);
      }

      return new Response(JSON.stringify({
        status: result.streamUrl ? 'success' : 'failed',
        original_url: destination,
        stream_url: result.streamUrl,
        format: result.format,
        proxy_url: result.streamUrl ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}` : undefined,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error: any) {
      Metrics.incrementError();
      return new Response(JSON.stringify({
        error: error.message,
        original_url: destination
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Auto-detect host from URL
   */
  detectHost(url: string): string | null {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }

    const hostPatterns: Record<string, string[]> = {
      'voe': ['voe.sx', 'voeplay.com', 'jeremyparticipantanything.com'],
      'vidmoly': ['vidmoly.biz', 'vidmoly.com'],
      'filemoon': ['filemoon.sx', 'filemoon.to', 'bysezejataos.com'],
      'filemoon-not-working': ['filemoon.sx', 'filemoon.to', 'bysezejataos.com'],
      'doodstream': ['doodstream.com', 'dood.watch', 'dood.cx', 'playmogo.com'],
      'doodstream-not-working': ['doodstream.com', 'dood.watch', 'dood.cx', 'playmogo.com'],
      'streamtape': ['streamtape.com', 'streamtape.net'],
      'vidoza': ['vidoza.net', 'vidoza.com'],
      'mixdrop': ['mixdrop.co', 'mixdrop.bz', 'mixdrop.to'],
      'filelions': ['filelions.live', 'filelions.online'],
      'streamwish': ['streamwish.com', 'streamwish.to', 'asnwave.com'],
      'vixcloud': ['vixcloud.com', 'vixcloud6.com'],
      'okru': ['ok.ru', 'odnoklassniki.ru'],
      'uqload': ['uqload.com', 'uqload.co'],
      'f16px': ['f16px.com'],
      'city': ['city.stream', 'city.online'],
      'lulustream': ['lulustream.com'],
      'turbovidplay': ['turbovidplay.com', 'vidplay.fun', 'videovip.to'],
      'maxstream': ['maxstream.live'],
      'fastream': ['fastream.to'],
      'vidfast': ['vidfast.com'],
      'sportsonline': ['sportsonline.live'],
      'vavoo': ['vavoo.to'],
      'gupload': ['gupload.io'],
      'livetv': ['livetv.sx'],
      'supervideo': ['supervideo.tv'],
    };

    for (const [host, patterns] of Object.entries(hostPatterns)) {
      if (patterns.some(p => hostname.includes(p))) {
        return host;
      }
    }

    return null;
  }

  // Extractors for each host

  private async extractVidplay(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    // Extract m3u8 URL
    const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
    if (m3u8Match) {
      return { streamUrl: m3u8Match[1], format: 'hls' };
    }

    // Extract direct mp4 URL
    const mp4Match = html.match(/source\s*src=["']([^"']+\.mp4[^"']*)["']/i) ||
                     html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
    if (mp4Match) {
      return { streamUrl: mp4Match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from vidplay');
  }

  private async extractDoodstream(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    const html = await response.text();

    // Doodstream often has the URL in a JavaScript variable
    const match = html.match(/dsverify\(['"]([^'"]+)['"]/) ||
                    html.match(/dl-https\(['"]([^'"]+)['"]/) ||
                    html.match(/(https?:\/\/[^"'\s]+\.(mp4|m3u8)[^"'\s]*)/i);

    if (match) {
      let streamUrl = match[1];
      if (streamUrl.startsWith('//')) {
        streamUrl = 'https:' + streamUrl;
      }
      const format = match[0].includes('.m3u8') ? 'hls' : 'mp4';
      return { streamUrl, format, headers: this.extractVideoHeaders(headers, html) };
    }

    // Try iframe redirect
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) {
      // Check if this looks like another extractor
      const iframeUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
      // Try to auto-detect the host from the iframe URL
      const autoHost = this.detectHost(iframeUrl);
      if (autoHost) {
        const iframeHeaders = { ...headers, 'Referer': url };
        const extracted = await this.extract(autoHost, iframeUrl, iframeHeaders);
        return extracted;
      }
      return this.extractVidplay(iframeUrl, { ...headers, 'Referer': url });
    }

    throw new Error('Could not extract stream URL from doodstream');
  }

  private async extractMixdrop(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    // Follow redirect to find the actual player
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    const html = await response.text();

    // Extract from JavaScript
    const match = html.match(/(https:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
                  html.match(/src:\s*["']([^"']+)["']/i) ||
                  html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);

    if (match) {
      return { streamUrl: match[1] || match[0], format: match[0].includes('.m3u8') ? 'hls' : 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from mixdrop');
  }

  private async extractFilemoon(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    // Try the API endpoint first (bysezejataos.com)
    const apiUrl = url.replace('/d/', '/api/videos/').replace('/e/', '/api/videos/');
    try {
      const response = await fetch(apiUrl, { headers });
      const data = await response.json() as any;
      
      // Check if playback data exists
      if (data?.playback?.payload) {
        // Try to find stream URL in the response
        const streamUrl = data.playback.stream_url || data.playback.url;
        if (streamUrl) {
          return { streamUrl, format: streamUrl.includes('.m3u8') ? 'hls' : 'mp4', headers: this.extractVideoHeaders(headers, url) };
        }
      }
      
      // Check for direct URL in response
      const directUrl = data?.playback?.url || data?.video?.stream_url || data?.url;
      if (directUrl) {
        return { streamUrl: directUrl, format: directUrl.includes('.m3u8') ? 'hls' : 'mp4' };
      }
    } catch {
      // API call failed, try HTML extraction
    }

    // Try HTML extraction
    const response = await fetch(url, { headers });
    const html = await response.text();

    // Try to find the stream URL in various formats
    const match = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: match[0].includes('.m3u8') ? 'hls' : 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from filemoon');
  }

  private async extractStreamtape(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    const html = await response.text();

    // Streamtape uses a specific pattern
    const match = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
                  html.match(/<source\s+src=["']([^"']+)["']/i);

    if (match) {
      return { streamUrl: match[1], format: match[0].includes('.m3u8') ? 'hls' : 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from streamtape');
  }

  private async extractVidoza(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from vidoza');
  }

  private async extractVoe(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    const html = await response.text();

    // VOE pattern: try multiple extraction methods
    const patterns = [
      /var\s+source\s*=\s*['"]([^'"]+)['"]/i,
      /id="[^"]*player[^"]*"[^>]*\s+src=["']([^"']+)["']/i,
      /<source\s+src=["']([^"']+)["']/i,
      /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i,
      /file:\s*["']([^"']+)["']/i,
      /"url":\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return { streamUrl: match[1], format: 'mp4', headers: this.extractVideoHeaders(headers, html) };
      }
    }

    // Try to extract from JavaScript variables
    const jsMatch = html.match(/(?:sources|files|files?)\s*[:=]\s*["']([^"']+)["']/i);
    if (jsMatch) {
      return { streamUrl: jsMatch[1], format: 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from voe');
  }

  private async extractDoodstreamFallback(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    return this.extractDoodstream(url, headers);
  }

  private async extractCity(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: match[0].includes('.m3u8') ? 'hls' : 'mp4' };
    }

    throw new Error('Could not extract stream URL from city');
  }

  private async extractLulustream(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from lulustream');
  }

  private async extractMaxstream(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from maxstream');
  }

  private async extractUqload(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from uqload');
  }

  private async extractF16px(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);

    if (match) {
      const format = match[0].includes('.m3u8') ? 'hls' : 'mp4';
      const extraHeaders: Record<string, string> = {};
      const authMatch = html.match(/Authorization:\s*([^,\s]+)/i);
      if (authMatch) {
        extraHeaders['Authorization'] = authMatch[1];
      }
      return {
        streamUrl: match[1],
        format,
        headers: { ...headers, ...extraHeaders },
      };
    }

    throw new Error('Could not extract stream URL from f16px');
  }

  private async extractFastream(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'hls' };
    }

    throw new Error('Could not extract stream URL from fastream');
  }

  private async extractOkru(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const jsonMatch = html.match(/"url":"([^"]+)"/i);
    const mp4Match = jsonMatch || html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (mp4Match) {
      const streamUrl = mp4Match[1] || mp4Match[0];
      return { streamUrl: decodeURIComponent(streamUrl), format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from okru');
  }

  private async extractVidfast(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from vidfast');
  }

  private async extractFilelions(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: match[0].includes('.m3u8') ? 'hls' : 'mp4' };
    }

    throw new Error('Could not extract stream URL from filelions');
  }

  private async extractSportsOnline(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) ||
                  html.match(/<source\s+src=["']([^"']+)["']/i);

    if (match) {
      return { streamUrl: match[1], format: 'hls' };
    }

    throw new Error('Could not extract stream URL from sportsonline');
  }

  private async extractVidMoly(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    // Try multiple patterns for VidMoly
    const patterns = [
      /<source\s+src=["']([^"']+)["']/i,
      /mp4:["']([^"']+)["']/i,
      /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i,
      /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i,
      /file["']?\s*:\s*["']([^"']+)["']/i,
      /sources["']?\s*:\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return { streamUrl: match[1], format: 'mp4', headers: this.extractVideoHeaders(headers, html) };
      }
    }

    throw new Error('Could not extract stream URL from vidmoly');
  }

  private async extractVavoo(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/\.src\(['"]([^'"]+)['"]\)/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'hls' };
    }

    throw new Error('Could not extract stream URL from vavoo');
  }

  private async extractStreamwish(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from streamwish');
  }

  private async extractVixCloud(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) ||
                  html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);

    if (match) {
      return { streamUrl: match[1], format: 'hls', headers: this.extractVideoHeaders(headers, html) };
    }

    throw new Error('Could not extract stream URL from vixcloud');
  }

  private async extractLiveTv(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'hls' };
    }

    throw new Error('Could not extract stream URL from livetv');
  }

  private async extractSuperVideo(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from supervideo');
  }

  private async extractGupload(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();

    const match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
    }

    throw new Error('Could not extract stream URL from gupload');
  }

  /**
   * Extract any additional headers needed from the page HTML
   */
  private extractVideoHeaders(originalHeaders: Record<string, string>, html: string): Record<string, string> {
    const headers: Record<string, string> = { ...originalHeaders };

    // Check for Referer header in HTML
    const refererMatch = html.match(/Referer\s*[:=]\s*["']([^"']+)["']/i);
    if (refererMatch) {
      headers['Referer'] = refererMatch[1];
    }

    return headers;
  }

  /**
   * Get list of supported extractor hosts
   */
  getSupportedHosts(): string[] {
    return [
      'city', 'lulustream', 'turbovidplay', 'doodstream', 'doodstream-not-working',
      'maxstream', 'uqload', 'f16px', 'mixdrop', 'vavoo', 'fastream', 'okru',
      'vidfast', 'filelions', 'sportsonline', 'vidmoly', 'filemoon', 'filemoon-not-working',
      'streamtape', 'vidoza', 'gupload', 'streamwish', 'vixcloud',
      'livetv', 'supervideo', 'voe', 'generic', 'pluto'
    ];
  }

  /**
   * Find all redirect links in HTML
   */
  private findRedirectLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const base = new URL(baseUrl);

    // Match /redirect/ID patterns
    const redirectMatches = html.matchAll(/\/redirect\/(\d+)/g);
    for (const match of redirectMatches) {
      const id = match[1];
      links.push(`${base.origin}/redirect/${id}`);
    }

    // Match aniworld.to/redirect/ID patterns
    const aniworldMatches = html.matchAll(/https?:\/\/aniworld\.to\/redirect\/(\d+)/g);
    for (const match of aniworldMatches) {
      if (!links.includes(match[0])) {
        links.push(match[0]);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }

  /**
   * Run extraction with a specific host
   */
  async extract(host: string, url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    switch (host) {
      case 'vidplay':
      case 'turbovidplay':
      case 'videovip':
        return this.extractVidplay(url, headers);
      case 'doodstream':
      case 'dood':
      case 'playmogo':
      case 'doodstream-not-working':
        return this.extractDoodstream(url, headers);
      case 'mixdrop':
      case 'mixdropco':
      case 'mixdropbz':
        return this.extractMixdrop(url, headers);
      case 'filemoon':
      case 'bysezejataos':
      case 'filemoon-not-working':
        return this.extractFilemoon(url, headers);
      case 'streamtape':
        return this.extractStreamtape(url, headers);
      case 'vidoza':
        return this.extractVidoza(url, headers);
      case 'voe':
      case 'voeplay':
      case 'jeremyparticipantanything':
        return this.extractVoe(url, headers);
      case 'vidmoly':
        return this.extractVidMoly(url, headers);
      case 'streamwish':
      case 'streamwishonline':
      case 'asnwave':
        return this.extractStreamwish(url, headers);
      case 'filelions':
      case 'filelionsonline':
        return this.extractFilelions(url, headers);
      case 'vixcloud':
      case 'vixcloud6':
        return this.extractVixCloud(url, headers);
      case 'okru':
        return this.extractOkru(url, headers);
      case 'uqload':
        return this.extractUqload(url, headers);
      case 'maxstream':
        return this.extractMaxstream(url, headers);
      case 'lulustream':
        return this.extractLulustream(url, headers);
      case 'city':
        return this.extractCity(url, headers);
      case 'vavoo':
        return this.extractVavoo(url, headers);
      case 'fastream':
        return this.extractFastream(url, headers);
      case 'vidfast':
        return this.extractVidfast(url, headers);
      case 'sportsonline':
        return this.extractSportsOnline(url, headers);
      case 'gupload':
        return this.extractGupload(url, headers);
      case 'livetv':
        return this.extractLiveTv(url, headers);
      case 'supervideo':
        return this.extractSuperVideo(url, headers);
      case 'f16px':
        return this.extractF16px(url, headers);
      case 'pluto':
        return this.extractPluto(url, headers);
      case 'generic':
        return this.extractGeneric(url, headers);
      default:
        throw new Error(`Unsupported host: ${host}`);
    }
  }

  /**
   * Generic extractor for unknown hosts
   * Tries to find stream URLs in common formats
   */
  private async extractGeneric(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });
    const html = await response.text();

    // Try multiple patterns for generic extraction
    const patterns = [
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

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const streamUrl = match[1];
        let format = 'mp4';
        if (streamUrl.includes('.m3u8')) format = 'hls';
        else if (streamUrl.includes('.mp3')) format = 'mp3';
        else if (streamUrl.includes('.m4a')) format = 'm4a';
        else if (streamUrl.includes('.m4v')) format = 'm4v';
        else if (streamUrl.includes('.webm')) format = 'webm';
        else if (streamUrl.includes('.ts')) format = 'ts';
        else if (streamUrl.includes('.aac')) format = 'aac';
        else if (streamUrl.includes('.wav')) format = 'wav';
        return { streamUrl, format, headers: this.extractVideoHeaders(headers, html) };
      }
    }

    throw new Error('Could not extract stream URL from generic host');
  }

  /**
   * Pluto TV extractor
   * Extracts streams from Pluto TV pages using their API
   */
  private async extractPluto(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    // Extract content ID from URL
    // Pattern: /shows/{showId}/episode/{contentId} or /watch/live-tv/#{channelId}
    const episodeMatch = url.match(/\/episode\/([^/?]+)/);
    const liveMatch = url.match(/live-tv\/#(\d+)/);

    let contentId = episodeMatch ? episodeMatch[1] : null;
    let channelId = liveMatch ? liveMatch[1] : null;

    if (!contentId && !channelId) {
      throw new Error('Could not extract Pluto TV content ID from URL');
    }

    // Try the playout API
    const apiUrl = contentId
      ? `https://ipv4.pluto.tv/api/tn/video/playout/${contentId}`
      : `https://ipv4.pluto.tv/api/tn/video/playout/live/${channelId}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Origin': 'https://pluto.tv',
        'Referer': 'https://pluto.tv/',
        'Accept': 'application/json',
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Pluto TV API error: ${response.status}`);
    }

    const data = await response.json() as any;

    // Look for HLS stream in the response
    const streamUrl = data?.stream_urls?.hls || data?.stream_url || data?.url;
    if (streamUrl) {
      return { streamUrl, format: 'hls', headers: this.extractVideoHeaders(headers, url) };
    }

    // Look for DASH stream
    const dashUrl = data?.stream_urls?.dash || data?.dash_url;
    if (dashUrl) {
      return { streamUrl: dashUrl, format: 'mpd', headers: this.extractVideoHeaders(headers, url) };
    }

    throw new Error('Could not extract stream URL from Pluto TV');
  }

  /**
   * Resolve redirect URL - follows redirects and returns the final URL
   * Useful for sites like aniworld.to that redirect to streaming hosts
   */
  async resolveRedirect(url: string, headers: Record<string, string> = {}): Promise<string> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      redirect: 'manual', // Don't follow, just get the Location header
    });

    // Check for 3xx redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        // Resolve relative URLs
        try {
          return new URL(location, url).toString();
        } catch {
          return location;
        }
      }
    }

    // If no redirect, follow to final URL
    const finalResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      redirect: 'follow',
    });

    return finalResponse.url;
  }

  /**
   * Resolve redirect and extract stream URL from the final destination
   * Useful for sites like aniworld.to that redirect to streaming hosts
   */
  async resolveRedirectAndExtract(url: string, headers: Record<string, string> = {}): Promise<ExtractionResult> {
    const finalUrl = await this.resolveRedirect(url, headers);
    
    // Try to extract from the final URL
    const host = this.detectHost(finalUrl);
    if (host) {
      return this.extract(host, finalUrl, headers);
    }

    // Fall back to generic extractor
    return this.extractGeneric(finalUrl, headers);
  }
}

interface ExtractionResult {
  streamUrl: string;
  format: string;
  headers?: Record<string, string>;
  [key: string]: any;
}