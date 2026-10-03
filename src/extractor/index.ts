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
      'doodstream': ['doodstream.com', 'dood.watch', 'dood.cx', 'playmogo.com'],
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
      'city', 'lulustream', 'turbovidplay', 'doodstream', 'maxstream',
      'uqload', 'f16px', 'mixdrop', 'vavoo', 'fastream', 'okru',
      'vidfast', 'filelions', 'sportsonline', 'vidmoly', 'filemoon',
      'streamtape', 'vidoza', 'gupload', 'streamwish', 'vixcloud',
      'livetv', 'supervideo', 'voe'
    ];
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
        return this.extractDoodstream(url, headers);
      case 'mixdrop':
      case 'mixdropco':
      case 'mixdropbz':
        return this.extractMixdrop(url, headers);
      case 'filemoon':
      case 'bysezejataos':
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
      default:
        throw new Error(`Unsupported host: ${host}`);
    }
  }
}

interface ExtractionResult {
  streamUrl: string;
  format: string;
  headers?: Record<string, string>;
  [key: string]: any;
}