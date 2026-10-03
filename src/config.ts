// src/config.ts - Configuration management for Cloudflare Worker
// Ported from the Rust config system

import { Env } from './index';

export class ConfigManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  get server(): ServerConfig {
    return {
      port: this.num('SERVER_PORT', 8888),
      workers: this.num('APP__SERVER__WORKERS', 4),
    };
  }

  get auth(): AuthConfig {
    return {
      apiPassword: this.env.APP__AUTH__API_PASSWORD || '',
    };
  }

  get proxy(): ProxyConfig {
    return {
      connectTimeout: this.num('APP__PROXY__CONNECT_TIMEOUT', 30),
      bufferSize: this.num('APP__PROXY__BUFFER_SIZE', 262144),
      followRedirects: this.bool('APP__PROXY__FOLLOW_REDIRECTS', true),
      proxyUrl: this.env.APP__PROXY__PROXY_URL || '',
      allProxy: this.bool('APP__PROXY__ALL_PROXY', false),
      transportRoutes: this.parseRoutes(),
    };
  }

  get hls(): HlsConfig {
    return {
      prebufferSegments: this.num('APP__HLS__PREBUFFER_SEGMENTS', 5),
      segmentCacheTtl: this.num('APP__HLS__SEGMENT_CACHE_TTL', 300),
      inactivityTimeout: this.num('APP__HLS__INACTIVITY_TIMEOUT', 60),
      requestTimeoutFactor: this.num('APP__PROXY__REQUEST_TIMEOUT_FACTOR', 8),
      maxConcurrentPerHost: this.num('APP__PROXY__MAX_CONCURRENT_PER_HOST', 10),
    };
  }

  get mpd(): MpdConfig {
    return {
      livePlaylistDepth: this.num('APP__MPD__LIVE_PLAYLIST_DEPTH', 8),
      liveInitCacheTtl: this.num('APP__MPD__LIVE_INIT_CACHE_TTL', 60),
      remuxToTs: this.bool('APP__MPD__REMUX_TO_TS', false),
    };
  }

  get drm(): DrmConfig {
    return {
      keyCacheTtl: this.num('APP__DRM__KEY_CACHE_TTL', 3600),
    };
  }

  get epg(): EpgConfig {
    return {
      cacheTtl: this.num('APP__EPG__CACHE_TTL', 3600),
    };
  }

  get logLevel(): string {
    return this.env.APP__LOG_LEVEL || 'info';
  }

  private num(key: string, defaultVal: number): number {
    const val = this.env[key as keyof Env];
    if (!val) return defaultVal;
    const parsed = parseInt(val as string, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  private bool(key: string, defaultVal: boolean): boolean {
    const val = this.env[key as keyof Env];
    if (!val) return defaultVal;
    return val === 'true' || val === '1' || val === 'yes';
  }

  private parseRoutes(): TransportRoute[] {
    const routesJson = this.env.APP__PROXY__TRANSPORT_ROUTES;
    if (!routesJson) return [];
    try {
      return JSON.parse(routesJson);
    } catch {
      return [];
    }
  }
}

export interface ServerConfig { port: number; workers: number; }
export interface AuthConfig { apiPassword: string; }
export interface ProxyConfig {
  connectTimeout: number;
  bufferSize: number;
  followRedirects: boolean;
  proxyUrl: string;
  allProxy: boolean;
  transportRoutes: TransportRoute[];
}
export interface HlsConfig {
  prebufferSegments: number;
  segmentCacheTtl: number;
  inactivityTimeout: number;
  requestTimeoutFactor: number;
  maxConcurrentPerHost: number;
}
export interface MpdConfig {
  livePlaylistDepth: number;
  liveInitCacheTtl: number;
  remuxToTs: boolean;
}
export interface DrmConfig { keyCacheTtl: number; }
export interface EpgConfig { cacheTtl: number; }

export interface TransportRoute {
  pattern: string;
  proxy?: boolean;
  proxy_url?: string;
  verify_ssl?: boolean;
}