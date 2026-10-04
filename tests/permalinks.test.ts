import { afterEach, describe, expect, it, vi } from 'vitest';
import { Extractors } from '../src/extractor';
import { ConfigManager } from '../src/config';
import { AuthManager } from '../src/auth';

const episode = 'https://aniworld.to/anime/stream/black-torch/staffel-1/episode-1';
const redirect = 'https://aniworld.to/redirect/4163357';
function setup() {
  const config = new ConfigManager({});
  return new Extractors(config, new AuthManager(config));
}
function request(source = episode, parameters: Record<string, string> = {}) {
  const url = new URL('https://worker.example/resolve_redirect/extract');
  url.searchParams.set('d', source);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return new Request(url);
}
async function handle(extractors: Extractors, req: Request) {
  return extractors.handleResolveRedirect(req, new URL(req.url));
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Fresh-resolution playback permalinks', () => {
  it('returns per-source Worker URLs rather than tokenized proxy URLs', async () => {
    const extractors = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<a href="/redirect/4163357">Play</a>')));
    vi.spyOn(extractors, 'resolveRedirectAndExtract').mockResolvedValue({ streamUrl: 'https://cdn.example/master.m3u8?token=expired-soon', format: 'hls' });
    const response = await handle(extractors, request(episode, { api_password: 'test', h_Referer: episode }));
    const data = await response.json() as any;
    const link = new URL(data.streams[0].permalink_url);
    expect(data.streams[0].proxy_url).toBe(link.href);
    expect(link.origin).toBe('https://worker.example');
    expect(link.searchParams.get('d')).toBe(redirect);
    expect(link.searchParams.get('play')).toBe('true');
    expect(link.searchParams.get('api_password')).toBe('test');
    expect(link.href).not.toContain('cdn.example');
  });

  it('generates HLS-only master variants containing stable permalinks', async () => {
    const extractors = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<a href="/redirect/4163357">HLS</a><a href="/redirect/123">MP4</a>')));
    vi.spyOn(extractors, 'resolveRedirectAndExtract')
      .mockResolvedValueOnce({ streamUrl: 'https://cdn.example/master.m3u8?token=one', format: 'hls' })
      .mockResolvedValueOnce({ streamUrl: 'https://cdn.example/video.mp4', format: 'mp4' });
    const response = await handle(extractors, request(episode, { output_format: 'm3u8' }));
    expect(response.headers.get('content-type')).toContain('mpegurl');
    const playlist = await response.text();
    expect(playlist).toContain('#EXT-X-STREAM-INF:');
    expect(playlist).toContain(encodeURIComponent(redirect));
    expect(playlist).not.toContain('cdn.example');
    expect(playlist).not.toContain('#EXT-X-ENDLIST');
    expect(playlist).not.toContain('#EXT-X-FALLBACK');
    expect(playlist).not.toContain(encodeURIComponent('https://aniworld.to/redirect/123'));
  });

  it('resolves again on each play and rewrites relative manifests, keys and segments', async () => {
    const extractors = setup();
    const resolve = vi.spyOn(extractors, 'resolveRedirectAndExtract')
      .mockResolvedValueOnce({ streamUrl: 'https://cdn.example/first/master.m3u8?token=one', format: 'hls', headers: { Referer: episode } })
      .mockResolvedValueOnce({ streamUrl: 'https://cdn.example/second/master.m3u8?token=two', format: 'hls', headers: { Referer: episode } });
    const fetchMock = vi.fn().mockResolvedValue(new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:5,\nsegment.ts\n#EXT-X-ENDLIST'));
    vi.stubGlobal('fetch', fetchMock);
    const req = request(redirect, { play: 'true', output_format: 'm3u8' });
    const first = await handle(extractors, req);
    const second = await handle(extractors, req);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(first.headers.get('cache-control')).toBe('no-store');
    const firstBody = await first.text(), secondBody = await second.text();
    expect(firstBody).toContain(encodeURIComponent('https://cdn.example/first/segment.ts'));
    expect(firstBody).toContain(encodeURIComponent('https://cdn.example/first/key.bin'));
    expect(secondBody).toContain(encodeURIComponent('https://cdn.example/second/segment.ts'));
    expect(firstBody).toContain('h_Referer=');
    expect(fetchMock.mock.calls[0][1].headers.Referer).toBe(episode);
  });

  it('supports M3U8 for a single source with no redirect links', async () => {
    const extractors = setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Host page')));
    vi.spyOn(extractors, 'resolveRedirectAndExtract').mockResolvedValue({ streamUrl: 'https://cdn.example/master.m3u8', format: 'hls' });
    const response = await handle(extractors, request(redirect, { output_format: 'm3u8' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('play=true');
  });

  it('does not disguise non-HLS content or upstream errors as a successful playlist', async () => {
    const extractors = setup();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('Unavailable', { status: 403 })));
    const resolve = vi.spyOn(extractors, 'resolveRedirectAndExtract').mockResolvedValue({ streamUrl: 'https://cdn.example/video.mp4', format: 'mp4' });
    expect((await handle(extractors, request(redirect, { output_format: 'm3u8' }))).status).toBe(422);
    resolve.mockResolvedValue({ streamUrl: 'https://cdn.example/master.m3u8', format: 'hls' });
    expect((await handle(extractors, request(redirect, { play: 'true' }))).status).toBe(403);
  });
});
