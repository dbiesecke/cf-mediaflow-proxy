// src/index.ts - Cloudflare Worker entry point for MediaFlow Proxy Light
// Converted from Rust/Actix to TypeScript/Cloudflare Workers

import { StreamProxy } from './proxy/stream';
import { HlsProxy } from './proxy/hls';
import { EpgProxy } from './proxy/epg';
import { Extractors } from './extractor';
import { XtreamCodes } from './xtream';
import { Utilities } from './utilities';
import { WebUI } from './web_ui';
import { McpInterface } from './mcp';
import { AuthManager } from './auth';
import { ConfigManager } from './config';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const config = new ConfigManager(env);
    const auth = new AuthManager(config);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Health check - always accessible
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.0.0-worker' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Route matching
    const routes = [
      { pattern: /^\/proxy\/stream(?:\/.*)?$/, handler: (r: Request) => new StreamProxy(config, auth).handle(r) },
      { pattern: /^\/proxy\/hls\/(.*)$/, handler: (r: Request) => new HlsProxy(config, auth).handle(r) },
      { pattern: /^\/proxy\/mpd\/(.*)$/, handler: (r: Request) => new HlsProxy(config, auth).handleMpd(r) },
      { pattern: /^\/proxy\/epg$/, handler: (r: Request) => new EpgProxy(config, auth).handle(r) },
      { pattern: /^\/proxy\/ip$/, handler: (r: Request) => new Utilities(config, auth).getProxyIp(r, url) },
      { pattern: /^\/proxy\/acestream\/(.*)$/, handler: (r: Request) => new StreamProxy(config, auth).handleAcestream(r) },
      { pattern: /^\/proxy\/telegram\/(.*)$/, handler: (r: Request) => new StreamProxy(config, auth).handleTelegram(r) },
      { pattern: /^\/extractor\/video/, handler: (r: Request) => new Extractors(config, auth).handle(r) },
      { pattern: /^\/resolve_redirect\/extract/, handler: (r: Request) => new Extractors(config, auth).handleResolveRedirect(r, url) },
      { pattern: /^\/resolve_redirect/, handler: (r: Request) => new Utilities(config, auth).resolveRedirect(r, url) },
      { pattern: /^\/resolve/, handler: (r: Request) => new Extractors(config, auth).handleResolve(r, url) },
      { pattern: /^\/mcp/, handler: (r: Request) => new McpInterface(config, auth).handleDiscovery(r, url) },
      { pattern: /^\/base64\/(encode|decode|check)$/, handler: (r: Request, m: string) => Utilities.handleBase64(r, config, auth, m) },
      { pattern: /^\/metrics$/, handler: (r: Request) => new Utilities(config, auth).handleMetrics(r) },
      { pattern: /^\/playlist\/builder$/, handler: (r: Request) => new WebUI(config, auth).playlistBuilder(r) },
      { pattern: /^\/speedtest$/, handler: (r: Request) => new WebUI(config, auth).speedtest(r) },
      { pattern: /^\/player_api\.php$/, handler: (r: Request) => new XtreamCodes(config, auth).playerApi(r, url) },
      { pattern: /^\/xmltv\.php$/, handler: (r: Request) => new XtreamCodes(config, auth).xmltv(r, url) },
      { pattern: /^\/get\.php$/, handler: (r: Request) => new XtreamCodes(config, auth).getM3u(r, url) },
      { pattern: /^\/[^/]+\/[^/]+\/[^/]+\.[^/]+$/, handler: (r: Request) => new XtreamCodes(config, auth).streamUrl(r, url) },
    ];

    for (const route of routes) {
      if (route.pattern.test(path)) {
        try {
          const match = route.pattern.exec(path);
          const matchParam = match && match[1] ? match[1] : '';
          return await route.handler(request, matchParam);
        } catch (error: any) {
          console.error('Handler error:', error);
          return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
      }
    }

    // Web UI (static assets)
    if (path === '/' || path === '/index.html' || path.startsWith('/static/') || path.startsWith('/app/')) {
      return WebUI.serveStatic(request, path);
    }

    return new Response('Not Found', { status: 404 });
  }
};

export interface Env {
  // Core config via environment variables
  APP__AUTH__API_PASSWORD?: string;
  APP__PROXY__CONNECT_TIMEOUT?: string;
  APP__PROXY__BUFFER_SIZE?: string;
  APP__PROXY__FOLLOW_REDIRECTS?: string;
  APP__PROXY__ALL_PROXY?: string;
  APP__PROXY__PROXY_URL?: string;
  APP__PROXY__TRANSPORT_ROUTES?: string;
  APP__HLS__PREBUFFER_SEGMENTS?: string;
  APP__HLS__SEGMENT_CACHE_TTL?: string;
  APP__HLS__INACTIVITY_TIMEOUT?: string;
  APP__MPD__LIVE_PLAYLIST_DEPTH?: string;
  APP__MPD__LIVE_INIT_CACHE_TTL?: string;
  APP__MPD__REMUX_TO_TS?: string;
  APP__DRM__KEY_CACHE_TTL?: string;
  APP__EPG__CACHE_TTL?: string;
  APP__REDIS__URL?: string;
  APP__LOG_LEVEL?: string;

  // Cloudflare bindings
  CACHE?: any; // KV namespace
  STORAGE?: any; // R2 bucket
}
