// src/extractor/extractors/pluto.ts
// Pluto TV extractor. Extracts streams from Pluto TV pages using their API.
//
// URL patterns:
//   /shows/{showId}/episode/{contentId}  → episode playout API
//   /watch/live-tv/#{channelId}            → live playout API

import { BaseExtractor } from '../base';
import { ExtractionResult, StreamFormat } from '../types';

export async function extractPluto(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExtractionResult> {
  // Extract content ID from URL
  const episodeMatch = url.match(/\/episode\/([^/?]+)/);
  const liveMatch = url.match(/live-tv\/#(\d+)/);

  const contentId = episodeMatch ? episodeMatch[1] : null;
  const channelId = liveMatch ? liveMatch[1] : null;

  if (!contentId && !channelId) {
    throw new Error('Could not extract Pluto TV content ID from URL');
  }

  // Try the playout API
  const apiUrl = contentId
    ? `https://ipv4.pluto.tv/api/tn/video/playout/${contentId}`
    : `https://ipv4.pluto.tv/api/tn/video/playout/live/${channelId}`;

  const response = await fetch(apiUrl, {
    headers: {
      Origin: 'https://pluto.tv',
      Referer: 'https://pluto.tv/',
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Pluto TV API error: ${response.status}`);
  }

  const data: any = await response.json();

  // Look for HLS stream in the response
  const streamUrl = data?.stream_urls?.hls || data?.stream_url || data?.url;
  if (streamUrl) {
    return BaseExtractor.result(streamUrl, 'hls', '', headers);
  }

  // Look for DASH stream
  const dashUrl = data?.stream_urls?.dash || data?.dash_url;
  if (dashUrl) {
    return BaseExtractor.result(dashUrl, 'mpd' as StreamFormat, '', headers);
  }

  throw new Error('Could not extract stream URL from Pluto TV');
}