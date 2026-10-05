// src/extractor/registry.ts
//
// Maps a host alias (e.g. 'doodstream', 'playmogo', 'dood') to the extractor
// function that knows how to pull a stream URL out of it. This is the single
// place host aliases are declared, so adding a new host means adding one
// entry here plus one file under src/extractor/extractors/.

import { ExtractionResult } from './types';
import { extractCity } from './extractors/city';
import { extractDoodstream } from './extractors/doodstream';
import { extractFastream } from './extractors/fastream';
import { extractFilelions } from './extractors/filelions';
import { extractFilemoon } from './extractors/filemoon';
import { extractF16px } from './extractors/f16px';
import { extractGeneric } from './extractors/generic';
import { extractLulustream } from './extractors/lulustream';
import { extractMaxstream } from './extractors/maxstream';
import { extractMixdrop } from './extractors/mixdrop';
import { extractOkru } from './extractors/okru';
import { extractPluto } from './extractors/pluto';
import { extractSportsOnline } from './extractors/sportsonline';
import { extractStreamtape } from './extractors/streamtape';
import { extractStreamwish } from './extractors/streamwish';
import { extractSuperVideo } from './extractors/supervideo';
import { extractUqload } from './extractors/uqload';
import { extractVavoo } from './extractors/vavoo';
import { extractVidfast } from './extractors/vidfast';
import { extractVidMoly } from './extractors/vidmoly';
import { extractVidoza } from './extractors/vidoza';
import { extractVidplay } from './extractors/vidplay';
import { extractVixCloud } from './extractors/vixcloud';
import { extractVoe } from './extractors/voe';
import { extractLiveTv } from './extractors/livetv';

export type ExtractorFn = (
  url: string,
  headers: Record<string, string>,
  options?: Record<string, any>
) => Promise<ExtractionResult>;

/** Each host alias maps to an extractor function. Some extractors accept
 * extra options (e.g. doodstream's iframe resolver) — the orchestrator
 * supplies those at call time. */
export interface HostEntry {
  fn: ExtractorFn;
}

export const HOST_REGISTRY: Record<string, HostEntry> = {
  city: { fn: extractCity },
  lulustream: { fn: extractLulustream },
  turbovidplay: { fn: extractVidplay },
  vidplay: { fn: extractVidplay },
  videovip: { fn: extractVidplay },
  doodstream: { fn: extractDoodstream },
  dood: { fn: extractDoodstream },
  playmogo: { fn: extractDoodstream },
  'doodstream-not-working': { fn: extractDoodstream },
  maxstream: { fn: extractMaxstream },
  uqload: { fn: extractUqload },
  f16px: { fn: extractF16px },
  mixdrop: { fn: extractMixdrop },
  mixdropco: { fn: extractMixdrop },
  mixdropbz: { fn: extractMixdrop },
  vavoo: { fn: extractVavoo },
  fastream: { fn: extractFastream },
  okru: { fn: extractOkru },
  vidfast: { fn: extractVidfast },
  filelions: { fn: extractFilelions },
  filelionsonline: { fn: extractFilelions },
  sportsonline: { fn: extractSportsOnline },
  vidmoly: { fn: extractVidMoly },
  filemoon: { fn: extractFilemoon },
  'filemoon-not-working': { fn: extractFilemoon },
  bysezejataos: { fn: extractFilemoon },
  streamtape: { fn: extractStreamtape },
  vidoza: { fn: extractVidoza },
  gupload: { fn: extractGeneric },
  streamwish: { fn: extractStreamwish },
  streamwishonline: { fn: extractStreamwish },
  asnwave: { fn: extractStreamwish },
  vixcloud: { fn: extractVixCloud },
  vixcloud6: { fn: extractVixCloud },
  livetv: { fn: extractLiveTv },
  supervideo: { fn: extractSuperVideo },
  voe: { fn: extractVoe },
  voeplay: { fn: extractVoe },
  jeremyparticipantanything: { fn: extractVoe },
  generic: { fn: extractGeneric },
  pluto: { fn: extractPluto },
};

/**
 * Auto-detect the host alias for a given URL by matching the hostname
 * against the patterns below. Returns null when no host is recognised.
 *
 * The pattern list intentionally mirrors the historical behaviour: the
 * `-not-working` variants are declared for backwards compatibility but the
 * canonical alias is matched first, so a URL like filemoon.sx resolves to
 * `filemoon`, not `filemoon-not-working`.
 */
export function detectHost(url: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  const hostPatterns: Record<string, string[]> = {
    voe: ['voe.sx', 'voeplay.com', 'jeremyparticipantanything.com'],
    vidmoly: ['vidmoly.biz', 'vidmoly.com'],
    filemoon: ['filemoon.sx', 'filemoon.to', 'bysezejataos.com'],
    'filemoon-not-working': ['filemoon.sx', 'filemoon.to', 'bysezejataos.com'],
    doodstream: ['doodstream.com', 'dood.watch', 'dood.cx', 'playmogo.com'],
    'doodstream-not-working': ['doodstream.com', 'dood.watch', 'dood.cx', 'playmogo.com'],
    streamtape: ['streamtape.com', 'streamtape.net'],
    vidoza: ['vidoza.net', 'vidoza.com'],
    mixdrop: ['mixdrop.co', 'mixdrop.bz', 'mixdrop.to'],
    filelions: ['filelions.live', 'filelions.online'],
    streamwish: ['streamwish.com', 'streamwish.to', 'asnwave.com'],
    vixcloud: ['vixcloud.com', 'vixcloud6.com'],
    okru: ['ok.ru', 'odnoklassniki.ru'],
    uqload: ['uqload.com', 'uqload.co'],
    f16px: ['f16px.com'],
    city: ['city.stream', 'city.online'],
    lulustream: ['lulustream.com'],
    turbovidplay: ['turbovidplay.com', 'vidplay.fun', 'videovip.to'],
    maxstream: ['maxstream.live'],
    fastream: ['fastream.to'],
    vidfast: ['vidfast.com'],
    sportsonline: ['sportsonline.live'],
    vavoo: ['vavoo.to'],
    gupload: ['gupload.io'],
    livetv: ['livetv.sx'],
    supervideo: ['supervideo.tv'],
    pluto: ['pluto.tv'],
  };

  for (const [host, patterns] of Object.entries(hostPatterns)) {
    if (patterns.some(p => hostname.includes(p))) {
      return host;
    }
  }

  return null;
}

/** Canonical list of supported host aliases (kept for API compatibility). */
export function getSupportedHosts(): string[] {
  return [
    'city', 'lulustream', 'turbovidplay', 'doodstream', 'doodstream-not-working',
    'maxstream', 'uqload', 'f16px', 'mixdrop', 'vavoo', 'fastream', 'okru',
    'vidfast', 'filelions', 'sportsonline', 'vidmoly', 'filemoon', 'filemoon-not-working',
    'streamtape', 'vidoza', 'gupload', 'streamwish', 'vixcloud',
    'livetv', 'supervideo', 'voe', 'generic', 'pluto',
  ];
}