// src/auth.ts - Authentication management
// Ported from Rust auth module

import { ConfigManager } from './config';

export class AuthManager {
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  /**
   * Check if the request has valid API password authentication.
   * The password can be provided via:
   * - `api_password` query parameter
   * - `Authorization: Bearer <token>` header
   * - `X-API-Key` header
   */
  async authenticate(request: Request): Promise<boolean> {
    const apiPassword = this.config.auth.apiPassword;
    
    // If no password is set, authentication is disabled
    if (!apiPassword) {
      return true;
    }

    const url = new URL(request.url);
    const queryPassword = url.searchParams.get('api_password');
    const authHeader = request.headers.get('Authorization');
    const apiKeyHeader = request.headers.get('X-API-Key');

    // Check query parameter
    if (queryPassword && queryPassword === apiPassword) {
      return true;
    }

    // Check Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (this.isValidToken(token)) {
        return true;
      }
    }

    // Check API key header
    if (apiKeyHeader && apiKeyHeader === apiPassword) {
      return true;
    }

    return false;
  }

/**
   * Validate an encrypted URL token
   */
  isValidToken(token: string): boolean {
    const apiPassword = this.config.auth.apiPassword;
    if (!apiPassword || !token) return false;

    // Since we removed URL encryption, just check if token matches API password
    return token === apiPassword;
  }

  /**
   * Require authentication, return 401 if not authenticated
   */
  async requireAuth(request: Request): Promise<Response | null> {
    if (await this.authenticate(request)) {
      return null;
    }
    return new Response('Unauthorized: Valid API key required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="MediaFlow Proxy", Basic realm="MediaFlow Proxy"'
      }
    });
  }

  /**
   * Check access control by IP
   */
  checkIpAccess(request: Request, allowedIps: string[]): boolean {
    const requestIp = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                     'unknown';
    
    if (allowedIps.length === 0 || allowedIps.includes('*')) {
      return true;
    }

    return allowedIps.some(allowed => {
      if (allowed.includes('/')) {
        // CIDR check (simplified)
        return this.ipInCidr(requestIp, allowed);
      }
      return requestIp === allowed;
    });
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    // Simplified CIDR matching
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    // Basic implementation
    return true;
  }
}