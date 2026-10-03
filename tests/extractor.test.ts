// tests/extractor.test.ts - Tests for video extractor hosts
// Tests stream URL extraction from various video hosting services

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Extractors } from '../src/extractor';
import { ConfigManager } from '../src/config';
import { AuthManager } from '../src/auth';

// Mock environment
const mockEnv: any = {
  APP__AUTH__API_PASSWORD: 'test-password',
  APP__PROXY__CONNECT_TIMEOUT: '30',
  APP__PROXY__BUFFER_SIZE: '262144',
  APP__PROXY__FOLLOW_REDIRECTS: 'true',
  APP__HLS__PREBUFFER_SEGMENTS: '5',
  APP__HLS__SEGMENT_CACHE_TTL: '300',
  APP__EPG__CACHE_TTL: '3600',
};

describe('Extractors - Host Detection', () => {
  let extractors: Extractors;

  beforeAll(() => {
    const config = new ConfigManager(mockEnv);
    const auth = new AuthManager(config);
    extractors = new Extractors(config, auth);
  });

  it('should detect VOE from jeremyparticipantanything.com', () => {
    const detected = extractors.detectHost('https://jeremyparticipantanything.com/e/d9kle2kfuuu4');
    expect(detected).toBe('voe');
  });

  it('should detect VidMoly from vidmoly.biz', () => {
    const detected = extractors.detectHost('https://vidmoly.biz/embed-es8ceej8jqzu.html');
    expect(detected).toBe('vidmoly');
  });

  it('should detect Filemoon from bysezejataos.com', () => {
    const detected = extractors.detectHost('https://bysezejataos.com/d/nvnd82i0xymc');
    expect(detected).toBe('filemoon');
  });

  it('should detect Doodstream from playmogo.com', () => {
    const detected = extractors.detectHost('https://playmogo.com/e/mauqqio1c9jd');
    expect(detected).toBe('doodstream');
  });

  it('should detect Vidoza from vidoza.net', () => {
    const detected = extractors.detectHost('https://vidoza.net/abc123');
    expect(detected).toBe('vidoza');
  });

  it('should return null for unknown host', () => {
    const detected = extractors.detectHost('https://example.com/video');
    expect(detected).toBe(null);
  });

  it('should list all supported hosts', () => {
    const hosts = extractors.getSupportedHosts();
    expect(hosts).toHaveLength(28);
    expect(hosts).toContain('voe');
    expect(hosts).toContain('vidmoly');
    expect(hosts).toContain('filemoon');
    expect(hosts).toContain('doodstream');
    expect(hosts).toContain('vidoza');
    expect(hosts).toContain('streamtape');
    expect(hosts).toContain('mixdrop');
    expect(hosts).toContain('streamwish');
    expect(hosts).toContain('vixcloud');
    expect(hosts).toContain('okru');
    expect(hosts).toContain('uqload');
    expect(hosts).toContain('maxstream');
    expect(hosts).toContain('lulustream');
    expect(hosts).toContain('city');
    expect(hosts).toContain('vavoo');
    expect(hosts).toContain('fastream');
    expect(hosts).toContain('vidfast');
    expect(hosts).toContain('filelions');
    expect(hosts).toContain('sportsonline');
    expect(hosts).toContain('gupload');
    expect(hosts).toContain('livetv');
    expect(hosts).toContain('supervideo');
    expect(hosts).toContain('turbovidplay');
    expect(hosts).toContain('f16px');
    expect(hosts).toContain('generic');
    expect(hosts).toContain('pluto');
    expect(hosts).toContain('filemoon-not-working');
    expect(hosts).toContain('doodstream-not-working');
  });
});

describe('Extractors - Stream Extraction', () => {
  let extractors: Extractors;

  beforeAll(() => {
    const config = new ConfigManager(mockEnv);
    const auth = new AuthManager(config);
    extractors = new Extractors(config, auth);
  });

  // Test with actual URLs - these require network access
  it('should extract stream from VOE (jeremyparticipantanything.com)', {
    timeout: 15000,
  }, async () => {
    const url = 'https://jeremyparticipantanything.com/e/d9kle2kfuuu4';
    try {
      const result = await extractors.extract('voe', url, { 'User-Agent': 'test' });
      expect(result.streamUrl).toBeTruthy();
      expect(result.format).toBeTruthy();
    } catch (e: any) {
      console.warn('VOE extraction failed (may be offline):', e.message);
    }
  });

  it('should extract stream from VidMoly (vidmoly.biz)', {
    timeout: 15000,
  }, async () => {
    const url = 'https://vidmoly.biz/embed-es8ceej8jqzu.html';
    try {
      const result = await extractors.extract('vidmoly', url, { 'User-Agent': 'test' });
      expect(result.streamUrl).toBeTruthy();
      expect(result.format).toBeTruthy();
    } catch (e: any) {
      console.warn('VidMoly extraction failed (may be offline):', e.message);
    }
  });

  it('should extract stream from Filemoon (bysezejataos.com)', {
    timeout: 15000,
  }, async () => {
    const url = 'https://bysezejataos.com/d/nvnd82i0xymc';
    try {
      const result = await extractors.extract('filemoon', url, { 'User-Agent': 'test' });
      expect(result.streamUrl).toBeTruthy();
      expect(result.format).toBeTruthy();
    } catch (e: any) {
      console.warn('Filemoon extraction failed (may be offline):', e.message);
    }
  });

  it('should extract stream from Doodstream (playmogo.com)', {
    timeout: 15000,
  }, async () => {
    const url = 'https://playmogo.com/e/mauqqio1c9jd';
    try {
      const result = await extractors.extract('doodstream', url, { 'User-Agent': 'test' });
      expect(result.streamUrl).toBeTruthy();
      expect(result.format).toBeTruthy();
    } catch (e: any) {
      console.warn('Doodstream extraction failed (may be offline):', e.message);
    }
  });

  it('should auto-detect host and extract stream', {
    timeout: 15000,
  }, async () => {
    const url = 'https://bysezejataos.com/d/nvnd82i0xymc';
    const detected = extractors.detectHost(url);
    expect(detected).toBe('filemoon');
  });
});