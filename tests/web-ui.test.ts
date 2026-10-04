import { describe, expect, it } from 'vitest';
import worker from '../src';

const request = (path: string) => worker.fetch(
  new Request('https://mediaflow.example' + path), {}, {} as ExecutionContext,
);

describe('Web UI routing', () => {
  it.each(['/', '/index.html'])('serves the self-contained workspace at %s', async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const html = await response.text();
    expect(html).toContain('id="tool-form"');
    expect(html).toContain('id="player"');
    expect(html).not.toContain('location.reload');
    // Validate the JavaScript actually shipped to browsers, including template escaping.
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });

  it.each([
    ['/playlist/builder?api_password=private', 'playlist'],
    ['/speedtest?api_password=private', 'speed'],
  ])('opens the integrated tool for %s without forwarding query credentials', async (path, tool) => {
    const response = await request(path);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://mediaflow.example/#' + tool);
  });
});
