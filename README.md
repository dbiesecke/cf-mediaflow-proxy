# MediaFlow Proxy Light - Cloudflare Worker Edition

A Cloudflare Worker implementation of [MediaFlow Proxy Light](https://github.com/mhdzumair/mediaflow-proxy-light) - a high-performance streaming proxy with HLS/DASH support, video extraction, EPG proxy, and Xtream Codes compatibility.

## Features

✅ **Stream Proxy** - Generic HTTP/HTTPS stream proxy with range request (seeking) support  
✅ **HLS Proxy** - M3U8 manifest and segment proxying with automatic URL rewriting  
✅ **DASH/MPD Support** - DASH manifest processing with segment proxying  
✅ **Video Extractors** - 24+ video hosting services (Vidoza, Streamtape, Filemoon, Mixdrop, etc.)  
✅ **EPG Proxy** - XMLTV/EPG pass-through with configurable caching  
✅ **Xtream Codes API** - Compatible with TiviMate, IPTV Smarters, and other XC clients  
✅ **Web UI** - Built-in URL generator, playlist builder, and speed test  
✅ **Authentication** - API password protection
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
GET /extractor/video?host=<host>&d=<url>&api_password=<key>
GET /extractor/video.mp4?host=<host>&d=<url>&api_password=<key>
```

**Supported Hosts (24):**
- vidoza, streamtape, filemoon, mixdrop, doodstream
- voe, okru, uqload, streamwish, vidmoly
- city, lulustream, turbovidplay, maxstream, f16px
- vavoo, fastream, vidfast, filelions, sportsonline
- gupload, vixcloud, livetv, supervideo

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
mpv "https://your-worker.workers.dev/proxy/stream?d=https://example.com/video.mp4&api_password=secret"

# HLS with custom headers
mpv "https://your-worker.workers.dev/proxy/hls/manifest.m3u8?d=https://example.com/live.m3u8&h_Referer=https://example.com&api_password=secret"
```

### EPG Proxy (Channels DVR, Plex, Emby)

```
https://your-worker.workers.dev/proxy/epg?d=https://provider.com/epg.xml&api_password=secret
```

### Video Extractor

```bash
# Get stream URL from Vidoza
curl "https://your-worker.workers.dev/extractor/video?host=vidoza&d=https://vidoza.net/abc123&api_password=secret"
```

### Xtream Codes (TiviMate)

```
URL: https://your-worker.workers.dev
Username: your_username
Password: your_api_password
```

## Authentication

The API password can be provided via:
1. Query parameter: `?api_password=secret`
2. Authorization header: `Authorization: Bearer secret`
3. Custom header: `X-API-Key: secret`

## Web UI

Visit the worker URL in a browser for the built-in Web UI:
- Stream proxy URL generator
- Video extractor
- EPG proxy tester
- Playlist builder
- Speed test
- Metrics viewer

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