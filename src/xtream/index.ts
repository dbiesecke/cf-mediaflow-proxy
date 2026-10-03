// src/xtream/index.ts - Xtream Codes API compatibility
// Ported from Rust xtream module

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

export class XtreamCodes {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  /**
   * Xtream Codes player_api.php endpoint
   * Provides compatibility with XC API clients (TiviMate, IPTV Smarters, etc.)
   */
  async playerApi(request: Request, url: URL): Promise<Response> {
    const type = url.searchParams.get('type');
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    const action = url.searchParams.get('action');

    // Validate credentials (same as API password if no user system)
    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Build response based on action
    switch (action) {
      case 'get_live_categories':
        return this.getLiveCategories();
      case 'get_live_streams':
        return this.getLiveStreams(url.searchParams.get('category_id'));
      case 'get_vod_categories':
        return this.getVodCategories();
      case 'get_vod_streams':
        return this.getVodStreams(url.searchParams.get('category_id'));
      case 'get_series_categories':
        return this.getSeriesCategories();
      case 'get_series':
        return this.getSeries(url.searchParams.get('category_id'));
      case 'get_series_info':
        return this.getSeriesInfo(url.searchParams.get('series_id'));
      case 'get_short_epg':
        return this.getShortEpg(url.searchParams.get('stream_id'), url.searchParams.get('limit'));
      case 'get_simple_data_table':
        return this.getSimpleDataTable(url.searchParams.get('stream_id'));
      default:
        // User info endpoint
        return this.getUserInfo();
    }
  }

  private getUserInfo(): Response {
    return new Response(JSON.stringify({
      user_info: {
        username: 'mediaflow',
        password: 'mediaflow',
        message: 'MediaFlow Proxy Light - Cloudflare Worker',
        auth: 1,
        status: 'Active',
        exp_date: null,
        is_trial: 0,
        created_at: Math.floor(Date.now() / 1000) - 86400,
        max_connections: 1,
        active_connections: 0,
        allowed_output_formats: ['m3u8', 'ts', 'mp4'],
      },
      server_info: {
        url: 'https://mediaflow-worker.example.com',
        port: 443,
        https_port: 443,
        server_protocol: 'https',
        rtmp_port: null,
        timezone: 'UTC',
        timestamp_now: Math.floor(Date.now() / 1000),
        time_now: new Date().toISOString(),
        process: 'mediaflow-proxy-worker',
      }
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getLiveCategories(): Response {
    // Return empty categories - this would be populated from actual IPTV source
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getLiveStreams(categoryId?: string | null): Response {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getVodCategories(): Response {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getVodStreams(categoryId?: string | null): Response {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getSeriesCategories(): Response {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getSeries(categoryId?: string | null): Response {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getSeriesInfo(seriesId?: string | null): Response {
    if (!seriesId) {
      return new Response(JSON.stringify({ error: 'Missing series_id' }), { status: 400 });
    }
    return new Response(JSON.stringify({
      info: { name: 'Unknown Series', cover: '', plot: '', cast: '', director: '', genre: '', releaseDate: '', last_modified: '' },
      episodes: []
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getShortEpg(streamId?: string | null, limit?: string | null): Response {
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return new Response(JSON.stringify({
      epg_listings: []
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  private getSimpleDataTable(streamId?: string | null): Response {
    return new Response(JSON.stringify({
      server_info: this.getUserInfo()
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  /**
   * xmltv.php - XMLTV EPG endpoint
   */
  async xmltv(request: Request, url: URL): Promise<Response> {
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');

    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Return empty XMLTV
    const xmltv = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv generator-info-name="MediaFlow Proxy Light Worker">
</tv>`;

    return new Response(xmltv, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="epg.xml"',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * get.php - M3U playlist export
   */
  async getM3u(request: Request, url: URL): Promise<Response> {
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    const type = url.searchParams.get('type') || 'live';
    const category_id = url.searchParams.get('category_id');

    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const playlist = `#EXTM3U
#EXTINF:-1 group-title="MediaFlow" tvg-logo="",MediaFlow Proxy Light
/proxy/stream?d=https://example.com/stream.m3u8`;

    return new Response(playlist, {
      headers: {
        'Content-Type': 'audio/mpegurl',
        'Content-Disposition': 'attachment; filename="playlist.m3u"',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * Short stream URL format: /<user>/<pass>/<id>.<ext>
   */
  async streamUrl(request: Request, url: URL): Promise<Response> {
    // Parse the path: /<username>/<password>/<stream_id>.<extension>
    const pathParts = url.pathname.split('/').filter(p => p);
    
    if (pathParts.length < 3) {
      return new Response('Invalid stream URL format', { status: 400 });
    }

    const [username, password, streamPart] = pathParts;
    const streamIdMatch = streamPart.match(/^(\d+)\.(.+)$/);
    
    if (!streamIdMatch) {
      return new Response('Invalid stream ID format', { status: 400 });
    }

    const [, streamId, extension] = streamIdMatch;

    // Validate credentials
    const authUrl = new URL(request.url);
    authUrl.searchParams.set('username', username);
    authUrl.searchParams.set('password', password);
    const authRequest = new Request(authUrl.toString(), request);

    if (!await this.auth.authenticate(authRequest)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // In a real implementation, this would map stream_id to actual stream URL
    // For now, return a placeholder
    return new Response('Stream not configured. Map stream IDs to actual URLs in your configuration.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}