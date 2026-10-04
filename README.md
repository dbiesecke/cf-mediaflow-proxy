# MediaFlow Proxy Light - Cloudflare Worker Edition

A Cloudflare Worker implementation of [MediaFlow Proxy Light](https://github.com/mhdzumair/mediaflow-proxy-light) - a high-performance streaming proxy with HLS/DASH support, video extraction, EPG proxy, and Xtream Codes compatibility.

## Features

✅ **Stream Proxy** - Generic HTTP/HTTPS stream proxy with range request (seeking) support  
✅ **HLS Proxy** - M3U8 manifest and segment proxying with automatic URL rewriting  
✅ **DASH/MPD Support** - DASH manifest processing with segment proxying  
✅ **Video Extractors** - 26+ video hosting services (Vidoza, Streamtape, Mixdrop, etc.)  
✅ **Pluto TV** - Extract live TV and VOD streams from Pluto TV  
✅ **Multi-Stream Extraction** - Extract multiple streams from pages with multiple redirect links  
✅ **Generic Extractor** - Auto-detects streams from any page (HLS, DASH, MP4, MP3, WebM, etc.)  
✅ **EPG Proxy** - XMLTV/EPG pass-through with configurable caching  
✅ **Xtream Codes API** - Compatible with TiviMate, IPTV Smarters, and other XC clients  
✅ **MCP Interface** - Public Model Context Protocol interface for AI agents (discovery, tools, resources)  
✅ **Auto-detect Host** - Automatically detects host from URL if not specified  
✅ **Redirect Stream** - Redirect directly to stream with `redirect_stream=true`  
✅ **No Authentication Required** - All endpoints are public  
✅ **CORS Support** - Full CORS headers for web playback

## Deployment

### Prerequisites

- Cloudflare account with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Quick Deploy

```bash
# Clone and setup
git clone <your-fork>
cd mediaflow-proxy-light-worker
npm install

# Configure your API password
wrangler secret put APP__AUTH__API_PASSWORD
# Enter your secure password when prompted

# Deploy
npm run deploy
```

### Configuration

All configuration is done via environment variables in `wrangler.toml` or Cloudflare Dashboard:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP__AUTH__API_PASSWORD` | API password (required) | - |
| `APP__PROXY__CONNECT_TIMEOUT` | Upstream connect timeout (seconds) | 30 |
| `APP__PROXY__BUFFER_SIZE` | Buffer size for streaming | 262144 |
| `APP__PROXY__FOLLOW_REDIRECTS` | Follow HTTP redirects | true |
| `APP__HLS__PREBUFFER_SEGMENTS` | HLS segments to prebuffer | 5 |
| `APP__HLS__SEGMENT_CACHE_TTL` | HLS segment cache TTL (seconds) | 300 |
| `APP__EPG__CACHE_TTL` | EPG cache TTL (seconds) | 3600 |

### Custom Domain (Optional)

```bash
# Add a custom domain
wrangler custom-domains add mediaflow.yourdomain.com
```

## API Endpoints

### Stream Proxy

| Method | Path | Description |
|--------|------|-------------|
| `GET/HEAD` | `/proxy/stream` | Generic HTTP stream proxy |
| `GET/HEAD` | `/proxy/stream/<filename>` | Stream proxy with filename hint |
| `GET/HEAD` | `/proxy/hls/manifest.m3u8` | HLS manifest proxy (rewrites segments) |
| `GET/HEAD` | `/proxy/hls/segment.<ext>` | HLS segment proxy |
| `GET/HEAD` | `/proxy/mpd/manifest.m3u8` | DASH manifest proxy |
| `GET/HEAD` | `/proxy/mpd/segment.mp4` | DASH segment proxy (fMP4) |

**Parameters:**
- `d` - Destination URL (plain or base64-encoded)
- `api_password` - API password (if not in header)
- `h_<Header>` - Custom headers (e.g., `h_Referer=https://example.com`)
- `range` - Range header for seeking

### Video Extractor

```
GET /extractor/video?host=<host>&d=<url>
GET /extractor/video.mp4?host=<host>&d=<url>
GET /extractor/video?host=<host>&d=<url>&redirect_stream=true
```

**Supported Hosts (27):**
- vidoza, streamtape, mixdrop, voe, okru, uqload, streamwish, vidmoly
- city, lulustream, turbovidplay, maxstream, f16px
- vavoo, fastream, vidfast, filelions, sportsonline
- gupload, vixcloud, livetv, supervideo
- filemoon, filemoon-not-working (Cloudflare protected)
- doodstream, doodstream-not-working (Cloudflare protected)
- generic (auto-detects HLS/DASH/MP4/MP3/WebM from any page)

**Auto-detect host:**
```bash
# Omit host parameter to auto-detect from URL
curl "https://your-worker.workers.dev/extractor/video?d=https://bysezejataos.com/d/nvnd82i0xymc"
```

**Redirect to stream directly:**
```bash
# redirect_stream=true returns a 302 redirect to the stream URL
curl -L "https://your-worker.workers.dev/extractor/video?d=https://bysezejataos.com/d/nvnd82i0xymc&redirect_stream=true"
```

**Multi-stream extraction (pages with multiple redirect links):**
```bash
# Extracts all streams from a page with multiple redirect links
curl "https://your-worker.workers.dev/resolve_redirect/extract?d=https://aniworld.to/anime/stream/black-torch/staffel-1/episode-1"
```

**Pluto TV:**
```bash
# Episode
curl "https://your-worker.workers.dev/extractor/video?host=pluto&d=https://pluto.tv/gsa/shows/2740225/episode/60dee91bfc802600134b8852/"

# Live TV
curl "https://your-worker.workers.dev/extractor/video?host=pluto&d=https://pluto.tv/gsa/watch/live-tv/#32227"
```

**Generic extractor (any page with stream):**
```bash
# Use host=generic to extract streams from any webpage
curl "https://your-worker.workers.dev/extractor/video?host=generic&d=https://www.example.com/video"
```

### Resolve Redirect

```
GET /resolve_redirect?d=<redirect_url>
GET /resolve_redirect/extract?d=<redirect_url>
GET /resolve?d=<url>
```

**Examples:**
```bash
# Simple redirect resolution
curl "https://your-worker.workers.dev/resolve_redirect?d=https://aniworld.to/redirect/4171793"

# Resolve and extract stream from redirect
curl "https://your-worker.workers.dev/resolve_redirect/extract?d=https://aniworld.to/redirect/4171793"

# Universal resolver - auto-detects host and extracts
curl "https://your-worker.workers.dev/resolve?d=https://pluto.tv/gsa/shows/2740225/episode/60dee91bfc802600134b8852/"
```

**Multi-stream extraction with `/resolve_redirect/extract`:**
```bash
# Extract all streams from a page with multiple redirect links
curl "https://your-worker.workers.dev/resolve_redirect/extract?d=https://aniworld.to/anime/stream/black-torch/staffel-1/episode-1"
```

> **Note on Cloudflare-protected hosts:** `filemoon` and `doodstream` use Cloudflare challenge pages that cannot be bypassed in Cloudflare Workers without additional infrastructure. They are marked as `-not-working` and will fail. Use `host=generic` as fallback for these URLs.

### Stable playback links and M3U8 output

`/resolve_redirect/extract` returns a `permalink_url` for each source; `proxy_url`
also points to this stable Worker URL. Save these links rather than the diagnostic
`stream_url`, whose upstream tokens can expire. Playback permalinks use the
original redirect URL with `play=true` and resolve it again on every request.

For direct HLS playback, append `output_format=m3u8` to an extraction request:

```
/resolve_redirect/extract?d=https%3A%2F%2Faniworld.to%2Fanime%2Fstream%2Fblack-torch%2Fstaffel-1%2Fepisode-1&output_format=m3u8
```

The master playlist contains HLS source permalinks. Individual playback requests
return the freshly resolved HLS manifest with playlist, segment, key and init-map
URLs routed through the Worker. MP4 sources can use playback permalinks but are
excluded from HLS master playlists. Alternative sources do not guarantee automatic
failover. Links stay usable while their original source remains available.

In the Web UI, select **Resolve & extract multiple streams → Output format → m3u8**
and use **Generate URL → Play**, **Open**, or copy the URL into a compatible player.

### MCP (Model Context Protocol) Interface

The Worker exposes a public MCP interface for AI agents to discover and use tools:

```
GET /mcp                    - MCP discovery (lists all tools)
GET /mcp/tools/list         - List all available tools
GET /mcp/tools/<tool_name>  - Get tool details
GET /mcp/resources          - List available resources
GET /mcp/prompts/list       - List available prompts
```

**Tools available:**
- `stream_proxy` - Proxy any HTTP stream
- `hls_proxy` - Proxy HLS manifests
- `mpd_proxy` - Proxy DASH manifests
- `video_extractor` - Extract stream URL from video hosts
- `epg_proxy` - Fetch XMLTV EPG data
- `xtream_player_api` - Xtream Codes Player API
- `xtream_m3u` - M3U playlist export
- `xtream_xmltv` - XMLTV EPG endpoint
- `base64_encode` / `base64_decode` - Base64 encoding
- `health_check` - Check worker health
- `list_supported_hosts` - List all extractor hosts
- `auto_detect_host` - Detect host from URL

### EPG Proxy

```
GET /proxy/epg?d=<epg_url>&api_password=<key>&cache_ttl=<seconds>&h_<Header>=<value>
```

Returns XMLTV data with `X-EPG-Cache: HIT/MISS` header.

### Xtream Codes API

| Path | Description |
|------|-------------|
| `/player_api.php` | XC Player API (get_live_streams, get_vod_streams, etc.) |
| `/xmltv.php` | XMLTV EPG endpoint |
| `/get.php` | M3U playlist export |
| `/<user>/<pass>/<id>.<ext>` | Short stream URL |

### Utilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/proxy/ip` | Get proxy IP info |
| `POST` | `/base64/encode` | Base64 encode URL |
| `POST` | `/base64/decode` | Base64 decode URL |
| `GET` | `/base64/check` | Check if base64 |
| `GET` | `/metrics` | Prometheus metrics (requires auth) |
| `GET` | `/playlist/builder` | M3U playlist builder UI |
| `GET` | `/speedtest` | Speed test UI |

## Usage Examples

### Stream Proxy (MPV/VLC)

```bash
# Generic stream
mpv "https://your-worker.workers.dev/proxy/stream?d=https://example.com/video.mp4"

# HLS with custom headers
mpv "https://your-worker.workers.dev/proxy/hls/manifest.m3u8?d=https://example.com/live.m3u8&h_Referer=https://example.com"
```

### Video Extractor with Auto-detect

```bash
# Auto-detect host from URL
curl "https://your-worker.workers.dev/extractor/video?d=https://bysezejataos.com/d/nvnd82i0xymc"

# Redirect directly to stream
curl -L "https://your-worker.workers.dev/extractor/video?d=https://bysezejataos.com/d/nvnd82i0xymc&redirect_stream=true"

# Specify host explicitly
curl "https://your-worker.workers.dev/extractor/video?host=voe&d=https://jeremyparticipantanything.com/e/d9kle2kfuuu4"

# Generic extractor for any page
curl "https://your-worker.workers.dev/extractor/video?host=generic&d=https://www.2ix2.com/rtl-live/"
```

### MCP Interface (AI Agents)

```bash
# Discover all tools
curl "https://your-worker.workers.dev/mcp"

# List all tools
curl "https://your-worker.workers.dev/mcp/tools/list"

# Auto-detect host from URL
curl "https://your-worker.workers.dev/mcp/tools/auto_detect_host?d=https://bysezejataos.com/d/nvnd82i0xymc"

# Extract stream with redirect
curl "https://your-worker.workers.dev/mcp/execute?tool=video_extractor&d=https://jeremyparticipantanything.com/e/d9kle2kfuuu4&redirect_stream=true"

# List supported hosts
curl "https://your-worker.workers.dev/mcp/tools/list_supported_hosts"

# Check health
curl "https://your-worker.workers.dev/mcp/tools/health_check"
```

### EPG Proxy (Channels DVR, Plex, Emby)

```
https://your-worker.workers.dev/proxy/epg?d=https://provider.com/epg.xml
```

### Video Extractor

```bash
# Get stream URL from Vidoza
curl "https://your-worker.workers.dev/extractor/video?host=vidoza&d=https://vidoza.net/abc123"
```

### Xtream Codes (TiviMate)

```
URL: https://your-worker.workers.dev
Username: your_username
Password: your_password
```

## Authentication

**No authentication required** - All endpoints are public by default.

## Web UI

Visit the worker URL in a browser for the built-in Web UI:

- Stream, HLS, DASH and EPG forms with custom upstream headers and URL generation
- Video extraction, host detection and redirect resolution
- Native browser media player (format support depends on the browser)
- M3U playlist builder with optional proxying, copy and download
- Xtream API, playlist and XMLTV forms
- Base64 encode/decode/check, health, IP information and metrics
- MCP discovery, resources, prompts and tool requests
- Proxy speed test with progress and cancellation

The UI is self-contained and requires no external JavaScript libraries or static
asset build. Responses are previewed up to 256 KiB; use generated links for full
downloads or playback. `/playlist/builder` and `/speedtest` open the corresponding
workspace tabs. API passwords entered in the UI stay in memory, while generated
URLs include any credentials needed for external clients.

Xtream data is currently sample or empty, with no configured stream IDs. AceStream
and Telegram are unavailable in this Worker; the UI does not enable these backend
capabilities. Live extraction also depends on availability of third-party hosts.

## Security Considerations

1. **All endpoints are public** - No API password required
2. **Use HTTPS** - Cloudflare Workers always use HTTPS
3. **Rate Limiting** - Cloudflare provides built-in DDoS protection
4. **CORS enabled** - All endpoints allow cross-origin requests for web playback

## Limitations vs Rust Version

| Feature | Rust Version | Worker Version |
|---------|--------------|----------------|
| Transcoding (FFmpeg) | ✅ | ❌ (not available in Workers) |
| Acestream P2P | ✅ | ❌ (no P2P in Workers) |
| Telegram MTProto | ✅ | ❌ (complex protocol) |
| SOCKS Proxy | ✅ | ❌ (no TCP in Workers) |
| DRM ClearKey | ✅ | ⚠️ (limited) |
| Redis Cache | ✅ | ✅ (via KV/DO) |
| Custom Routing | ✅ | ⚠️ (simplified) |

## Performance

- **Cold Start**: ~10-50ms
- **Memory**: 128MB limit (Workers free tier)
- **CPU Time**: 10ms (free) / 50ms (paid) per request
- **Streaming**: Supported via `ReadableStream` with range requests
- **Cache**: Cloudflare Cache API + KV + Durable Objects

## Development

```bash
# Local development
npm run dev

# Type checking
npm run typecheck

# View logs
npm run tail
```

## Architecture

```
src/
├── index.ts          # Main entry point & routing
├── config.ts         # Configuration management
├── auth.ts           # Authentication & authorization
├── utils/index.ts    # Shared utilities
├── proxy/
│   ├── stream.ts     # Generic stream proxy
│   ├── hls.ts        # HLS/DASH proxy
│   └── epg.ts        # EPG proxy
├── extractor/
│   └── index.ts      # 24 video host extractors
├── xtream/
│   └── index.ts      # Xtream Codes API
├── utilities/
│   └── index.ts      # Utility endpoints
├── web_ui/
│   └── index.ts      # Web UI & static files
└── worker-configuration.d.ts  # TypeScript types
```

## Security Considerations

1. **Always set `APP__AUTH__API_PASSWORD`** - Without it, all endpoints are public
2. **Use HTTPS** - Cloudflare Workers always use HTTPS
3. **Rate Limiting** - Cloudflare provides built-in DDoS protection

## License

MIT License - Same as the original MediaFlow Proxy Light project.

## Credits

Based on [MediaFlow Proxy Light](https://github.com/mhdzumair/mediaflow-proxy-light) by mhdzumair.
Converted to Cloudflare Workers architecture.
