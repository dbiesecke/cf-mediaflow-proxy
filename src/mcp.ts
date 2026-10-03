// src/mcp.ts - Model Context Protocol interface for MediaFlow Proxy
// Provides a public interface for AI agents to discover and use endpoints

import { Extractors } from './extractor';
import { ConfigManager } from './config';
import { AuthManager } from './auth';
import { Metrics } from './utils';

export class McpInterface {
  private config: ConfigManager;
  private auth: AuthManager;
  private extractors: Extractors;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
    this.extractors = new Extractors(config, auth);
  }

  /**
   * MCP discovery endpoint
   * Returns all available tools and their schemas
   */
  async handleDiscovery(request: Request, url: URL): Promise<Response> {
    const path = url.pathname;
    const action = url.searchParams.get('action');

    // Main MCP discovery endpoint
    if (path === '/mcp' || path === '/mcp/') {
      return new Response(JSON.stringify({
        mcp: '2.0',
        name: 'MediaFlow Proxy Light - Worker Edition',
        description: 'A Cloudflare Worker implementation of MediaFlow Proxy for streaming proxy, video extraction, HLS/DASH proxying, and Xtream Codes API compatibility.',
        version: '1.0.0-worker',
        tools: this.getTools(),
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Tool-specific endpoints
    return this.handleToolRequest(request, url);
  }

  /**
   * Return all available MCP tools
   */
  private getTools() {
    return [
      {
        name: 'stream_proxy',
        description: 'Proxy any HTTP/HTTPS stream with range request support. Ideal for video/audio streams, live HLS, DASH manifests.',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'Destination URL (plain or base64-encoded)', title: 'Destination URL' },
            api_password: { type: 'string', description: 'API password for authentication', title: 'API Password' },
            h_Referer: { type: 'string', description: 'Custom Referer header', title: 'Referer' },
            range: { type: 'string', description: 'Range header for seeking (e.g., bytes=0-1024)', title: 'Range' },
          },
          required: ['d', 'api_password'],
        },
        endpoint: '/proxy/stream',
        method: 'GET',
      },
      {
        name: 'hls_proxy',
        description: 'Proxy HLS manifests with automatic segment URL rewriting. Supports real-time manifest rewriting.',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'HLS m3u8 URL (plain or base64-encoded)', title: 'M3U8 URL' },
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
            h_Referer: { type: 'string', description: 'Custom Referer header', title: 'Referer' },
          },
          required: ['d', 'api_password'],
        },
        endpoint: '/proxy/hls/manifest.m3u8',
        method: 'GET',
      },
      {
        name: 'mpd_proxy',
        description: 'Proxy DASH/MPD manifests and segments. Supports fMP4 and MPEG-TS segment output.',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'MPD manifest URL', title: 'Manifest URL' },
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
          },
          required: ['d', 'api_password'],
        },
        endpoint: '/proxy/mpd/manifest.m3u8',
        method: 'GET',
      },
      {
        name: 'video_extractor',
        description: 'Extract direct stream URLs from 24+ video hosting services. Auto-detects host if not specified. Use redirect_stream=true to get a direct redirect to the stream.',
        parameters: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Video host name (optional - auto-detected if omitted). Supported: vidoza, streamtape, filemoon, mixdrop, doodstream, voe, vidmoly, etc.', title: 'Host' },
            d: { type: 'string', description: 'Video page URL (plain or base64-encoded)', title: 'Video URL' },
            redirect_stream: { type: 'string', enum: ['true', 'false'], description: 'If true, redirects directly to the stream URL instead of returning JSON', title: 'Redirect Stream' },
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
            h_Referer: { type: 'string', description: 'Custom Referer header', title: 'Referer' },
          },
          required: ['d', 'api_password'],
        },
        endpoint: '/extractor/video',
        method: 'GET',
      },
      {
        name: 'epg_proxy',
        description: 'Fetch and cache XMLTV/EPG data from any upstream source. Compatible with Channels DVR, Plex, Emby, Jellyfin.',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'Upstream EPG URL (plain or base64-encoded)', title: 'EPG URL' },
            cache_ttl: { type: 'string', description: 'Override cache TTL in seconds (0 to disable)', title: 'Cache TTL' },
            h_Authorization: { type: 'string', description: 'Authorization header for protected EPG sources', title: 'Authorization' },
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
          },
          required: ['d', 'api_password'],
        },
        endpoint: '/proxy/epg',
        method: 'GET',
      },
      {
        name: 'xtream_player_api',
        description: 'Xtream Codes Player API - stateless pass-through for live, VOD, series, timeshift/catch-up, and XMLTV EPG',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username', title: 'Username' },
            password: { type: 'string', description: 'Password / API key', title: 'Password' },
            action: { type: 'string', enum: ['get_live_categories', 'get_live_streams', 'get_vod_categories', 'get_vod_streams', 'get_series_categories', 'get_series', 'get_series_info', 'get_short_epg', 'get_simple_data_table'], description: 'API action', title: 'Action' },
            category_id: { type: 'string', description: 'Category ID (for get_*_streams actions)', title: 'Category ID' },
          },
          required: ['username', 'password', 'action'],
        },
        endpoint: '/player_api.php',
        method: 'GET',
      },
      {
        name: 'xtream_m3u',
        description: 'M3U playlist export for Xtream Codes compatible clients',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username', title: 'Username' },
            password: { type: 'string', description: 'Password / API key', title: 'Password' },
            type: { type: 'string', description: 'Content type (live, vod, series)', title: 'Type' },
            category_id: { type: 'string', description: 'Category ID', title: 'Category ID' },
          },
          required: ['username', 'password'],
        },
        endpoint: '/get.php',
        method: 'GET',
      },
      {
        name: 'xtream_xmltv',
        description: 'XMLTV EPG endpoint for Xtream Codes compatible clients',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username', title: 'Username' },
            password: { type: 'string', description: 'Password / API key', title: 'Password' },
          },
          required: ['username', 'password'],
        },
        endpoint: '/xmltv.php',
        method: 'GET',
      },
      {
        name: 'base64_encode',
        description: 'Base64-encode a URL for safe transmission',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'URL to encode', title: 'URL' },
          },
          required: ['d'],
        },
        endpoint: '/base64/encode',
        method: 'POST',
      },
      {
        name: 'base64_decode',
        description: 'Base64-decode a URL that was encoded',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'Base64-encoded URL', title: 'Encoded URL' },
          },
          required: ['d'],
        },
        endpoint: '/base64/decode',
        method: 'POST',
      },
      {
        name: 'health_check',
        description: 'Check if the MediaFlow Proxy worker is healthy and responding',
        parameters: { type: 'object' },
        endpoint: '/health',
        method: 'GET',
      },
      {
        name: 'get_proxy_ip',
        description: 'Get proxy IP information (client IP + Cloudflare shared IP note)',
        parameters: {
          type: 'object',
          properties: {
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
          },
          required: ['api_password'],
        },
        endpoint: '/proxy/ip',
        method: 'GET',
      },
      {
        name: 'get_metrics',
        description: 'Get Prometheus-style metrics for the proxy (requests, bytes, errors, uptime)',
        parameters: {
          type: 'object',
          properties: {
            api_password: { type: 'string', description: 'API password', title: 'API Password' },
          },
          required: ['api_password'],
        },
        endpoint: '/metrics',
        method: 'GET',
      },
      {
        name: 'list_supported_hosts',
        description: 'Get the list of all supported video extractor hosts',
        parameters: { type: 'object' },
        endpoint: '/extractor/video',
        method: 'GET',
      },
      {
        name: 'auto_detect_host',
        description: 'Detect which extractor host a given URL belongs to',
        parameters: {
          type: 'object',
          properties: {
            d: { type: 'string', description: 'Video page URL to detect host for', title: 'Video URL' },
          },
          required: ['d'],
        },
        endpoint: '/mcp/tools/auto_detect_host',
        method: 'GET',
      },
    ];
  }

  /**
   * Handle tool-specific MCP requests
   */
  private async handleToolRequest(request: Request, url: URL): Promise<Response> {
    const path = url.pathname;
    const search = url.search;

    // Handle /mcp/tools/<tool_name> endpoints
    if (path.startsWith('/mcp/tools/')) {
      const toolName = path.replace('/mcp/tools/', '');
      return this.executeTool(toolName, request, url);
    }

    // Handle /mcp/execute for direct tool execution
    if (path === '/mcp/execute') {
      const toolName = url.searchParams.get('tool');
      if (!toolName) {
        return new Response(JSON.stringify({ error: 'Missing "tool" parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return this.executeTool(toolName, request, url);
    }

    // Handle /mcp/resources for resource discovery
    if (path === '/mcp/resources' || path === '/mcp/resources/') {
      return new Response(JSON.stringify({
        resources: [
          {
            uri: 'mediaflow://supported-hosts',
            name: 'Supported Extractor Hosts',
            description: 'List of all supported video extractor hosts',
            mimeType: 'application/json',
          },
          {
            uri: 'mediaflow://health',
            name: 'Worker Health',
        description: 'Current health status of the worker',
            mimeType: 'application/json',
          },
          {
            uri: 'mediaflow://metrics',
            name: 'Proxy Metrics',
            description: 'Current proxy metrics and statistics',
            mimeType: 'text/plain',
          },
        ]
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle /mcp/resources/<uri> for resource access
    if (path.startsWith('/mcp/resources/')) {
      const resourceUri = decodeURIComponent(url.searchParams.get('uri') || '');
      return this.handleResource(resourceUri, request, url);
    }

    // Handle /mcp/tools/list - list all tools (MCP protocol)
    if (path === '/mcp/tools/list') {
      return new Response(JSON.stringify({
        tools: this.getTools(),
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle /mcp/prompts/list - list available prompts (MCP protocol)
    if (path === '/mcp/prompts/list') {
      return new Response(JSON.stringify({
        prompts: [
          {
            name: 'extract_stream',
            description: 'Extract a direct stream URL from a video hosting service',
            arguments: {
              d: 'Video page URL',
              host: 'Optional host name (auto-detected if omitted)',
              redirect_stream: 'Set to "true" to redirect to stream directly',
            },
          },
          {
            name: 'proxy_stream',
            description: 'Generate a proxied stream URL',
            arguments: {
              d: 'Destination stream URL',
              h_Referer: 'Optional Referer header',
            },
          },
          {
            name: 'epg_proxy',
            description: 'Set up EPG proxy for Channels DVR or Plex',
            arguments: {
              d: 'EPG XMLTV URL',
              cache_ttl: 'Cache TTL in seconds',
            },
          },
        ],
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Execute a specific tool
   */
  private async executeTool(toolName: string, request: Request, url: URL): Promise<Response> {
    const d = url.searchParams.get('d');
    const pwd = url.searchParams.get('api_password');
    const redirectStream = url.searchParams.get('redirect_stream') === 'true';
    const host = url.searchParams.get('host')?.toLowerCase();

    switch (toolName) {
      case 'video_extractor':
      case 'video_extractor_redirect': {
        if (!d) {
          return new Response(JSON.stringify({
            error: 'Missing "d" parameter (video page URL)',
            tools: this.getTools().filter(t => t.name === 'video_extractor'),
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Auto-detect host if not specified
        let detectedHost: string | null = host || null;
        if (!detectedHost) {
          detectedHost = this.extractors.detectHost(d);
          if (!detectedHost) {
            return new Response(JSON.stringify({
              error: 'Could not auto-detect host',
              supported_hosts: this.extractors.getSupportedHosts(),
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        try {
          const result = await this.extractors.extract(detectedHost!, d, {});

          if (redirectStream && result.streamUrl) {
            return Response.redirect(result.streamUrl, 302);
          }

          return new Response(JSON.stringify({
            status: 'success',
            detected_host: detectedHost,
            stream_url: result.streamUrl,
            format: result.format,
            proxy_url: result.streamUrl
              ? `https://${url.hostname}/proxy/stream?d=${encodeURIComponent(result.streamUrl)}`
              : undefined,
            requires_redirect: redirectStream,
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (error: any) {
          Metrics.incrementError();
          return new Response(JSON.stringify({
            status: 'failed',
            error: error.message,
            host: detectedHost,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      case 'stream_proxy':
        if (!d) {
          return new Response(JSON.stringify({ error: 'Missing "d" parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          result: 'Use /proxy/stream?d=' + encodeURIComponent(d) + (pwd ? '&api_password=' + pwd : ''),
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'hls_proxy':
        if (!d) {
          return new Response(JSON.stringify({ error: 'Missing "d" parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          result: 'Use /proxy/hls/manifest.m3u8?d=' + encodeURIComponent(d) + (pwd ? '&api_password=' + pwd : ''),
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'list_supported_hosts':
        return new Response(JSON.stringify({
          hosts: this.extractors.getSupportedHosts(),
          count: this.extractors.getSupportedHosts().length,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'auto_detect_host':
        if (!d) {
          return new Response(JSON.stringify({ error: 'Missing "d" parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          url: d,
          detected_host: this.extractors.detectHost(d),
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'health_check':
        return new Response(JSON.stringify({
          status: 'ok',
          version: '1.0.0-worker',
          uptime: Metrics.getMetrics().uptime_seconds,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'get_metrics':
        return new Response(
          Object.entries(Metrics.getMetrics())
            .map(([k, v]) => `# ${k}: ${v}`)
            .join('\n'),
          {
            headers: { 'Content-Type': 'text/plain' }
          }
        );

      default:
        return new Response(JSON.stringify({
          error: `Unknown tool: ${toolName}`,
          available_tools: this.getTools().map(t => t.name),
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }

  /**
   * Handle resource requests
   */
  private async handleResource(uri: string, request: Request, url: URL): Promise<Response> {
    switch (uri) {
      case 'mediaflow://supported-hosts':
        return new Response(JSON.stringify({
          hosts: this.extractors.getSupportedHosts(),
          count: this.extractors.getSupportedHosts().length,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'mediaflow://health':
        return new Response(JSON.stringify({
          status: 'ok',
          version: '1.0.0-worker',
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      case 'mediaflow://metrics':
        return new Response(
          Object.entries(Metrics.getMetrics())
            .map(([k, v]) => `# ${k}: ${v}`)
            .join('\n'),
          {
            headers: { 'Content-Type': 'text/plain' }
          }
        );

      default:
        return new Response(JSON.stringify({
          error: `Unknown resource: ${uri}`,
          available_resources: ['/mcp/resources/uri=...'],
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }
}

export default McpInterface;