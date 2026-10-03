// src/web_ui/index.ts - Web UI with static file serving
// Ported from Rust web_ui module

import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { UrlUtils, Metrics } from '../utils';

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
    // Embedded static files for the web UI
    // In production, these would be built from a frontend framework
    
    if (path === '/' || path === '/index.html') {
      return this.getIndexHtml();
    }

    // Return 404 for other static files (would be built in real deployment)
    return new Response('Not Found', { status: 404 });
  }

  /**
   * Main index page - embedded as string
   */
  static getIndexHtml(): Response {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaFlow Proxy Light - Cloudflare Worker</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
        .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { color: #1a1a1a; margin-bottom: 0.5rem; }
        h2 { color: #333; margin-bottom: 1rem; }
        .subtitle { color: #666; margin-bottom: 2rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input, select, textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
        button { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #1d4ed8; }
        button:disabled { background: #9ca3af; cursor: not-allowed; }
        .result { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 1rem; margin-top: 1rem; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow: auto; }
        .endpoint { font-family: monospace; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 3px; }
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
        .tab { padding: 0.75rem 1rem; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .tab.active { border-bottom-color: #2563eb; color: #2563eb; font-weight: 500; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .api-key { font-family: monospace; background: #fef3c7; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }
        .error { color: #dc2626; }
        .success { color: #16a34a; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MediaFlow Proxy Light</h1>
        <p class="subtitle">Cloudflare Worker Edition - Streaming Proxy & Extractor</p>

        <div class="card">
            <h2>Configuration</h2>
            <p>Set your API password in Cloudflare Workers dashboard: <code>APP__AUTH__API_PASSWORD</code></p>
            <div class="form-group">
                <label>API Password (for this session)</label>
                <input type="password" id="apiPassword" placeholder="Enter API password">
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" data-tab="proxy">Stream Proxy</button>
            <button class="tab" data-tab="extractor">Video Extractor</button>
            <button class="tab" data-tab="epg">EPG Proxy</button>
            <button class="tab" data-tab="xtream">Xtream Codes</button>
            <button class="tab" data-tab="utils">Utilities</button>
        </div>

        <!-- Stream Proxy Tab -->
        <div class="tab-content active" id="tab-proxy">
            <div class="card">
                <h2>Generic Stream Proxy</h2>
                <p>Proxy any HTTP/HTTPS stream with range request support</p>
                <div class="form-group">
                    <label>Destination URL</label>
                    <input type="url" id="streamUrl" placeholder="https://example.com/video.mp4">
                </div>
                <div class="form-group">
                    <label>Custom Headers (JSON)</label>
                    <textarea id="streamHeaders" rows="3" placeholder='{"Referer": "https://example.com"}'></textarea>
                </div>
                <button onclick="generateProxyUrl('stream')">Generate Proxy URL</button>
                <div class="result" id="streamResult"></div>
            </div>

            <div class="card">
                <h2>HLS Manifest Proxy</h2>
                <p>Proxy HLS streams with automatic manifest rewriting</p>
                <div class="form-group">
                    <label>M3U8 URL</label>
                    <input type="url" id="hlsUrl" placeholder="https://example.com/live.m3u8">
                </div>
                <div class="form-group">
                    <label>Custom Headers (JSON)</label>
                    <textarea id="hlsHeaders" rows="3"></textarea>
                </div>
                <button onclick="generateProxyUrl('hls')">Generate Proxy URL</button>
                <div class="result" id="hlsResult"></div>
            </div>
        </div>

        <!-- Extractor Tab -->
        <div class="tab-content" id="tab-extractor">
            <div class="card">
                <h2>Video Host Extractor</h2>
                <p>Extract direct stream URLs from 24+ video hosting services</p>
                <div class="form-group">
                    <label>Host</label>
                    <select id="extHost">
                        <option value="">Select host...</option>
                        <option value="vidoza">Vidoza</option>
                        <option value="streamtape">Streamtape</option>
                        <option value="filemoon">Filemoon</option>
                        <option value="mixdrop">Mixdrop</option>
                        <option value="doodstream">Doodstream</option>
                        <option value="voe">Voe</option>
                        <option value="okru">OK.ru</option>
                        <option value="uqload">Uqload</option>
                        <option value="streamwish">Streamwish</option>
                        <option value="vidmoly">VidMoly</option>
                        <option value="city">City</option>
                        <option value="lulustream">Lulustream</option>
                        <option value="turbovidplay">Turbovidplay</option>
                        <option value="maxstream">Maxstream</option>
                        <option value="f16px">F16px</option>
                        <option value="vavoo">Vavoo</option>
                        <option value="fastream">Fastream</option>
                        <option value="vidfast">Vidfast</option>
                        <option value="filelions">Filelions</option>
                        <option value="sportsonline">SportsOnline</option>
                        <option value="gupload">Gupload</option>
                        <option value="vixcloud">VixCloud</option>
                        <option value="livetv">LiveTV</option>
                        <option value="supervideo">SuperVideo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Video Page URL</label>
                    <input type="url" id="extUrl" placeholder="https://vidoza.net/abc123">
                </div>
                <button onclick="extractVideo()">Extract Stream</button>
                <div class="result" id="extResult"></div>
            </div>
        </div>

        <!-- EPG Proxy Tab -->
        <div class="tab-content" id="tab-epg">
            <div class="card">
                <h2>EPG / XMLTV Proxy</h2>
                <p>Fetch and cache EPG data from any XMLTV source</p>
                <div class="form-group">
                    <label>EPG URL</label>
                    <input type="url" id="epgUrl" placeholder="https://provider.com/epg.xml">
                </div>
                <div class="form-group">
                    <label>Cache TTL (seconds, 0=disable)</label>
                    <input type="number" id="epgTtl" value="3600" min="0">
                </div>
                <div class="form-group">
                    <label>Custom Headers (JSON)</label>
                    <textarea id="epgHeaders" rows="3"></textarea>
                </div>
                <button onclick="fetchEpg()">Fetch EPG</button>
                <div class="result" id="epgResult"></div>
            </div>
        </div>

        <!-- Xtream Codes Tab -->
        <div class="tab-content" id="tab-xtream">
            <div class="card">
                <h2>Xtream Codes API Compatibility</h2>
                <p>Endpoints for TiviMate, IPTV Smarters, and other XC clients</p>
                <div class="result">
Base URL: <span class="endpoint">https://your-worker.workers.dev</span>

Endpoints:
/player_api.php?username=USER&password=PASS&action=get_live_streams
/xmltv.php?username=USER&password=PASS
/get.php?username=USER&password=PASS
/<user>/<pass>/<id>.<ext>
                </div>
            </div>
        </div>

        <!-- Utilities Tab -->
        <div class="tab-content" id="tab-utils">
            <div class="card">
                <h2>Utility Endpoints</h2>
                <div class="form-group">
                    <label>URL to encode/decode</label>
                    <input type="url" id="utilUrl" placeholder="https://example.com/video.m3u8">
                </div>
                <button onclick="base64Encode()">Base64 Encode</button>
                <button onclick="base64Decode()">Base64 Decode</button>
                <div class="result" id="utilResult"></div>
            </div>
            <div class="card">
                <h2>Proxy IP</h2>
                <button onclick="getProxyIp()">Get Proxy IP</button>
                <div class="result" id="ipResult"></div>
            </div>
            <div class="card">
                <h2>Metrics</h2>
                <button onclick="fetchMetrics()">Fetch Metrics</button>
                <div class="result" id="metricsResult"></div>
            </div>
        </div>
    </div>

    <script>
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            });
        });

        const API_BASE = '';
        const getApiPassword = () => document.getElementById('apiPassword').value;

        function addAuth(url) {
            const pwd = getApiPassword();
            if (pwd) {
                const u = new URL(url, window.location.origin);
                u.searchParams.set('api_password', pwd);
                return u.toString();
            }
            return url;
        }

        async function fetchJson(url) {
            const res = await fetch(url);
            const text = await res.text();
            try {
                return { ok: res.ok, data: JSON.parse(text) };
            } catch {
                return { ok: res.ok, data: text };
            }
        }

        function generateProxyUrl(type) {
            const pwd = getApiPassword();
            const base = window.location.origin;
            
            if (type === 'stream') {
                const url = document.getElementById('streamUrl').value;
                const headers = document.getElementById('streamHeaders').value;
                if (!url) return alert('Enter destination URL');
                
                const params = new URLSearchParams({ d: url, api_password: pwd || '' });
                if (headers) {
                    try {
                        const h = JSON.parse(headers);
                        for (const [k, v] of Object.entries(h)) {
                            params.set('h_' + k.replace(/-/g, '_'), v);
                        }
                    } catch { alert('Invalid JSON'); return; }
                }
                
                const proxyUrl = base + '/proxy/stream?' + params.toString();
                document.getElementById('streamResult').textContent = proxyUrl;
            } else if (type === 'hls') {
                const url = document.getElementById('hlsUrl').value;
                const headers = document.getElementById('hlsHeaders').value;
                if (!url) return alert('Enter M3U8 URL');
                
                const params = new URLSearchParams({ d: url, api_password: pwd || '' });
                if (headers) {
                    try {
                        const h = JSON.parse(headers);
                        for (const [k, v] of Object.entries(h)) {
                            params.set('h_' + k.replace(/-/g, '_'), v);
                        }
                    } catch { alert('Invalid JSON'); return; }
                }
                
                const proxyUrl = base + '/proxy/hls/manifest.m3u8?' + params.toString();
                document.getElementById('hlsResult').textContent = proxyUrl;
            }
        }

        async function extractVideo() {
            const host = document.getElementById('extHost').value;
            const url = document.getElementById('extUrl').value;
            const pwd = getApiPassword();
            if (!host || !url) return alert('Select host and enter URL');

            const params = new URLSearchParams({ host, d: url, api_password: pwd || '' });
            const resultEl = document.getElementById('extResult');
            resultEl.textContent = 'Extracting...';
            
            try {
                const res = await fetch('/extractor/video?' + params.toString());
                const data = await res.json();
                resultEl.textContent = JSON.stringify(data, null, 2);
                resultEl.className = 'result ' + (data.status === 'success' ? 'success' : 'error');
            } catch (e) {
                resultEl.textContent = 'Error: ' + e.message;
                resultEl.className = 'result error';
            }
        }

        async function fetchEpg() {
            const url = document.getElementById('epgUrl').value;
            const ttl = document.getElementById('epgTtl').value;
            const headers = document.getElementById('epgHeaders').value;
            const pwd = getApiPassword();
            if (!url) return alert('Enter EPG URL');

            const params = new URLSearchParams({ d: url, api_password: pwd || '' });
            if (ttl) params.set('cache_ttl', ttl);
            if (headers) {
                try {
                    const h = JSON.parse(headers);
                    for (const [k, v] of Object.entries(h)) {
                        params.set('h_' + k.replace(/-/g, '_'), v);
                    }
                } catch { alert('Invalid JSON'); return; }
            }

            const resultEl = document.getElementById('epgResult');
            resultEl.textContent = 'Fetching...';
            
            try {
                const res = await fetch('/proxy/epg?' + params.toString());
                const text = await res.text();
                const cache = res.headers.get('X-EPG-Cache');
                resultEl.textContent = 'Cache: ' + cache + '\\n\\n' + text.substring(0, 2000) + (text.length > 2000 ? '...' : '');
            } catch (e) {
                resultEl.textContent = 'Error: ' + e.message;
                resultEl.className = 'result error';
            }
        }

        async function getProxyIp() {
            const pwd = getApiPassword();
            const res = await fetch('/proxy/ip?' + new URLSearchParams({ api_password: pwd || '' }));
            const text = await res.text();
            document.getElementById('ipResult').textContent = text;
        }

        async function base64Encode() {
            const url = document.getElementById('utilUrl').value;
            const pwd = getApiPassword();
            if (!url) return alert('Enter URL');
            const res = await fetch('/base64/encode?' + new URLSearchParams({ d: url, api_password: pwd || '' }), { method: 'POST' });
            const data = await res.json();
            document.getElementById('utilResult').textContent = JSON.stringify(data, null, 2);
        }

        async function base64Decode() {
            const url = document.getElementById('utilUrl').value;
            const pwd = getApiPassword();
            if (!url) return alert('Enter encoded string');
            const res = await fetch('/base64/decode?' + new URLSearchParams({ d: url, api_password: pwd || '' }), { method: 'POST' });
            const data = await res.json();
            document.getElementById('utilResult').textContent = JSON.stringify(data, null, 2);
        }

        async function fetchMetrics() {
            const pwd = getApiPassword();
            const res = await fetch('/metrics?' + new URLSearchParams({ api_password: pwd || '' }));
            const text = await res.text();
            document.getElementById('metricsResult').textContent = text;
        }
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  /**
   * /playlist/builder - M3U playlist builder
   */
  async playlistBuilder(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pwd = url.searchParams.get('api_password');

    if (!await this.auth.authenticate(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Return HTML form for playlist builder
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