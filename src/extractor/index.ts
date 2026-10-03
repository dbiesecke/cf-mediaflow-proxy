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
    const host = url.searchParams.get('host')?.toLowerCase();
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!host) {
      return new Response(JSON.stringify({ 
        error: 'Missing "host" parameter',
        supported_hosts: this.getSupportedHosts()
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

  // Extractors for each host
  // ... (implement each extractor based on the original Rust source)

  private async extractVidplay(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    // Fetch the video page
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
    const response = await fetch(url, { headers });
    const html = await response.text();
    
    // Doodstream often has the URL in a JavaScript variable
    const match = html.match(/dsverify\(['"]([^'"]+)['"]/) ||
                    html.match(/dl-https\(['"]([^'"]+)['"]/) ||
                    html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
    
    if (match) {
      // Some need URL decoding
      let streamUrl = match[1];
      if (streamUrl.startsWith('//')) {
        streamUrl = 'https:' + streamUrl;
      }
      return { streamUrl, format: 'mp4' };
    }
    
    // Try iframe redirect
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) {
      return this.extractVidplay(iframeMatch[1], headers);
    }
    
    throw new Error('Could not extract stream URL from doodstream');
  }

  private async extractMixdrop(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    // Follow redirect to find the actual player
    const response = await fetch(url, { 
      headers,
      redirect: 'follow' 
    });
    const html = await response.text();
    
    // Extract from JavaScript
    const match = html.match(/https:\/\/[^"'\s]+\.mp4[^"'\s]*/i) ||
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
    
    const match = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/<source\s+src=["']([^"']+)["']/i);
    
    if (match) {
      return { streamUrl: match[1], format: match[0].includes('.m3u8') ? 'hls' : 'mp4', headers: this.extractVideoHeaders(headers, html) };
    }
    
    throw new Error('Could not extract stream URL from filemoon');
  }

  private async extractStreamtape(url: string, headers: Record<string, string>): Promise<ExtractionResult> {
    const response = await fetch(url, { headers });
    const html = await response.text();
    
    // Streamtape uses a specific pattern
    const match = html.match(/id="[^"]*video[^"]*"[^>]*>\s*<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+streamtape\.com[^"'\s]*)/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
    
    if (match) {
      return { streamUrl: match[1] || match[0], format: 'hls' };
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
    const response = await fetch(url, { headers });
    const html = await response.text();
    
    const match = html.match(/id="[^"]*player[^"]*"[^>]*\s+src=["']([^"']+)["']/i) ||
                  html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
    
    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
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
      return { 
        streamUrl: match[1], 
        format: match[0].includes('.m3u8') ? 'hls' : 'mp4',
        headers: match[0].includes('key') ? { h_Authorization: html.match(/Authorization:\s*([^,\s]+)/i)?.[1] || '' } : {} 
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
    
    const match = html.match(/<source\s+src=["']([^"']+)["']/i) ||
                  html.match(/mp4:["']([^"']+)["']/i);
    
    if (match) {
      return { streamUrl: match[1], format: 'mp4' };
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
    
    const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
    
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
}

interface ExtractionResult {
  streamUrl: string;
  format: string;
  headers?: Record<string, string>;
  [key: string]: any;
}