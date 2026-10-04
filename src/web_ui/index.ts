// src/web_ui/index.ts - Web UI with static file serving
// Enhanced WebUI with Alpine.js SPA

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

// Static file paths
const STATIC_PATH = '/home/foilo/pentest/cf-worker/src/web_ui/static';
const INDEX_HTML = '/home/foilo/pentest/cf-worker/src/web_ui/index.html';

export class WebUI {
  private config: ConfigManager;
  private auth: AuthManager;

  constructor(config: ConfigManager, auth: AuthManager) {
    this.config = config;
    this.auth = auth;
  }

  /**
   * Serve static files for the Web UI
   */
  static async serveStatic(request: Request, path: string): Promise<Response> {
    const url = new URL(request.url);
    
    // Serve index.html for root and SPA routes
    if (path === '/' || path === '/index.html') {
      return this.serveHtmlFile(INDEX_HTML, request);
    }

    // Serve static assets (CSS, JS, etc.)
    if (path.startsWith('/static/') || path.startsWith('/app/')) {
      const filePath = path.startsWith('/static/') 
        ? path.replace('/static', STATIC_PATH)
        : path.replace('/app', '/home/foilo/pentest/cf-worker/src/web_ui/assets');
      return this.serveFile(filePath, request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Serve HTML file with proper headers
   */
  private static async serveHtmlFile(filePath: string, request: Request): Promise<Response> {
    try {
      const content = await fetch(new Request(filePath));
      if (content.ok) {
        const text = await content.text();
        return new Response(text, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    } catch (error) {
      console.error('Failed to serve HTML:', error);
    }
    
    // Fallback: return basic HTML page
    return new Response(this.getFallbackHtml(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  /**
   * Serve static files (CSS, JS, images)
   */
  private static async serveFile(filePath: string, request: Request): Promise<Response> {
    try {
      const content = await fetch(new Request(filePath));
      if (content.ok) {
        const data = await content.arrayBuffer();
        const ext = filePath.split('.').pop()?.toLowerCase();
        const contentType = this.getContentType(ext || '');
        
        return new Response(data, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    } catch (error) {
      console.error('Failed to serve file:', error);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  /**
   * Get content type based on file extension
   */
  private static getContentType(ext: string): string {
    const types: Record<string, string> = {
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'html': 'text/html',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Fallback HTML if index.html is not available
   */
  private static getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaFlow Proxy Light</title>
    <style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}h1{color:#1a1a1a}h2{color:#333}.card{background:#fff;border-radius:8px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.1)}</style>
</head>
<body>
    <div class="card">
        <h1>MediaFlow Proxy Light</h1>
        <p>Enhanced WebUI is loading...</p>
        <p>Please wait while the dashboard initializes.</p>
    </div>
    <script>setTimeout(() => location.reload(), 3000);</script>
</body>
</html>`;
  }

  /**
   * /playlist/builder - M3U playlist builder
   */
  async playlistBuilder(request: Request): Promise<Response> {
    const pwd = new URL(request.url).searchParams.get('api_password');

    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const html = `<!DOCTYPE html>
<html>
<head><title>M3U Playlist Builder</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}textarea{width:100%;height:300px;font-family:monospace}button{padding:.75rem 1.5rem;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer}</style>
</head>
<body>
<h1>M3U Playlist Builder</h1>
<p>Paste channel entries (one per line): name|url|group|logo</p>
<textarea id="channels" placeholder="Channel Name|https://example.com/stream.m3u8|Sports|https://example.com/logo.png"></textarea>
<br><br>
<button onclick="build()">Build Playlist</button>
<pre id="output"></pre>
<script>
function build() {
  const lines = document.getElementById('channels').value.trim().split('\\n');
  let m3u = '#EXTM3U\\n';
  for (const line of lines) {
    const [name, url, group, logo] = line.split('|');
    if (name && url) {
      m3u += '#EXTINF:-1';
      if (group) m3u += ' group-title="' + group + '"';
      if (logo) m3u += ' tvg-logo="' + logo + '"';
      m3u += ',' + name + '\\n' + url + '\\n';
    }
  }
  document.getElementById('output').textContent = m3u;
}
</script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  /**
   * /speedtest - Speed test UI
   */
  async speedtest(request: Request): Promise<Response> {
    const pwd = new URL(request.url).searchParams.get('api_password');

    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const html = `<!DOCTYPE html>
<html>
<head><title>Speed Test</title>
<style>body{font-family:sans-serif;max-width:600px;margin:2rem auto;padding:0 1rem}button{padding:.75rem 1.5rem;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;margin:.5rem}.result{font-family:monospace;background:#f5f5f5;padding:1rem;margin-top:1rem}</style>
</head>
<body>
<h1>Speed Test</h1>
<p>Test download speed through the proxy</p>
<button onclick="testSpeed()">Run Speed Test</button>
<div class="result" id="result"></div>
<script>
async function testSpeed() {
  const btn = document.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  const testUrl = 'https://speed.cloudflare.com/__down?bytes=10000000';
  const proxyUrl = '/proxy/stream?d=' + encodeURIComponent(testUrl);
  
  const start = performance.now();
  try {
    const res = await fetch(proxyUrl);
    const reader = res.body?.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      total += value.length;
    }
    const elapsed = (performance.now() - start) / 1000;
    const mbps = (total * 8 / 1000000) / elapsed;
    document.getElementById('result').textContent = 'Downloaded: ' + (total/1024/1024).toFixed(2) + ' MB\\nTime: ' + elapsed.toFixed(2) + 's\\nSpeed: ' + mbps.toFixed(2) + ' Mbps';
  } catch (e) {
    document.getElementById('result').textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Run Speed Test';
}
</script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  /**
   * /resolve_redirect - Resolve a redirect URL
   */
  async resolveRedirect(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const d = url.searchParams.get('d');
    const destination = UrlUtils.decodeUrl(d);

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Missing "d" parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(destination, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });

      return new Response(JSON.stringify({
        original_url: destination,
        final_url: response.url,
        status: response.status,
        redirected: response.url !== destination,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({
        error: error.message,
        original_url: destination
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
