// src/durable_objects.ts - Durable Objects for caching and state management

import { Env } from './index';

/**
 * Durable Object for generic caching with TTL support
 */
export class CacheDO {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const action = url.searchParams.get('action') || 'get';

    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    switch (action) {
      case 'get': {
        const value = await this.state.storage.get(key);
        return new Response(JSON.stringify({ value }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      case 'set': {
        const value = url.searchParams.get('value');
        const ttl = parseInt(url.searchParams.get('ttl') || '3600', 10);
        await this.state.storage.put(key, value, { expirationTtl: ttl } as any);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      case 'delete': {
        await this.state.storage.delete(key);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      default:
        return new Response('Invalid action', { status: 400 });
    }
  }
}

/**
 * Durable Object for EPG caching with specialized handling
 */
export class EPGCacheDO {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const action = url.searchParams.get('action') || 'get';

    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    switch (action) {
      case 'get': {
        const value = await this.state.storage.get(key);
        return new Response(JSON.stringify({ value }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      case 'set': {
        const value = url.searchParams.get('value');
        const ttl = parseInt(url.searchParams.get('ttl') || '3600', 10);
        await this.state.storage.put(key, value, { expirationTtl: ttl } as any);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      default:
        return new Response('Invalid action', { status: 400 });
    }
  }
}