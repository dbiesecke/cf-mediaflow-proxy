// src/utilities/index.ts - Utility endpoints
// Ported from Rust utilities module

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

export class Utilities {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  /**
   * /proxy/ip - Get public IP of the proxy server
   */
  async getProxyIp(request: Request, url: URL): Promise<Response> {
    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // In Cloudflare Workers, we can get the egress IP via an external service
    // or use the CF-Connecting-IP header for the incoming IP
    const clientIp = request.headers.get('CF-Connecting-IP') ||
                     request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                     'unknown';

    // For actual proxy egress IP, we'd need to fetch from an external service
    // This is a limitation of Cloudflare Workers - we don't have a fixed egress IP
    const proxyIp = `Proxy IP: Cloudflare Workers use shared IPs. Client IP: ${clientIp}`;

    return new Response(proxyIp, {
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * /base64/encode - Base64 encode a URL
   */
  /**
   * /base64/decode - Base64 decode a URL
   */
  /**
   * /base64/check - Check if string is base64 encoded
   */
  static async handleBase64(request: Request, config: ConfigManager, auth: AuthManager, action: string): Promise<Response> {
    if (!await auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (action === 'check' && request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (['encode', 'decode'].includes(action) && request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      let input: string;

      if (action === 'check') {
        const url = new URL(request.url);
        input = url.searchParams.get('d') || '';
      } else {
        const body = await request.json() as { d?: string };
        input = body.d || '';
      }

      if (!input) {
        return new Response(JSON.stringify({ error: 'Missing "d" parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let result: string | boolean = '';

      switch (action) {
        case 'encode':
          result = btoa(input);
          break;
        case 'decode':
          result = atob(input);
          break;
        case 'check':
          result = UrlUtils.isBase64(input);
          break;
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }

      return new Response(JSON.stringify({ result }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * /metrics - Prometheus-style metrics endpoint
   */
  async handleMetrics(request: Request): Promise<Response> {
    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const metrics = Metrics.getMetrics();
    
    const output = [
      `# HELP mediaflow_requests_total Total number of requests handled`,
      `# TYPE mediaflow_requests_total counter`,
      `mediaflow_requests_total ${metrics.requests_total}`,
      `# HELP mediaflow_bytes_transferred_total Total bytes transferred`,
      `# TYPE mediaflow_bytes_transferred_total counter`,
      `mediaflow_bytes_transferred_total ${metrics.bytes_transferred_total}`,
      `# HELP mediaflow_errors_total Total number of errors`,
      `# TYPE mediaflow_errors_total counter`,
      `mediaflow_errors_total ${metrics.errors_total}`,
      `# HELP mediaflow_uptime_seconds Uptime in seconds`,
      `# TYPE mediaflow_uptime_seconds gauge`,
      `mediaflow_uptime_seconds ${metrics.uptime_seconds}`,
    ].join('\n');

    return new Response(output, {
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
    });
  }
}