// src/extractor/types.ts - Shared types for video extractors

/**
 * Result returned by a single host extractor.
 * `streamUrl` is null when extraction failed; the orchestrator maps that
 * to a 404/500 response depending on context.
 */
export interface ExtractionResult {
  streamUrl: string | null;
  format: string;
  headers?: Record<string, string>;
  [key: string]: any;
}

/** Supported stream formats. */
export type StreamFormat =
  | 'hls'
  | 'mp4'
  | 'mp3'
  | 'm4a'
  | 'm4v'
  | 'webm'
  | 'ts'
  | 'aac'
  | 'wav'
  | 'mpd';