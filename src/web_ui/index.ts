import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { dashboard } from './dashboard';

export class WebUI {
  constructor(_config: ConfigManager, private auth: AuthManager) {}

  static async serveStatic(_request: Request, path: string): Promise<Response> {
    if (path !== '/' && path !== '/index.html') {
      return new Response('Not Found', { status: 404 });
    }
    return new Response(dashboard, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  async playlistBuilder(request: Request): Promise<Response> {
    return this.openTool(request, 'playlist');
  }

  async speedtest(request: Request): Promise<Response> {
    return this.openTool(request, 'speed');
  }

  private async openTool(request: Request, tool: string): Promise<Response> {
    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const url = new URL(request.url);
    url.pathname = '/';
    url.search = '';
    url.hash = tool;
    return new Response(null, { status: 302, headers: { Location: url.href } });
  }
}
