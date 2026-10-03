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
   * Authentication is disabled by default - all requests are allowed.
   */
  async authenticate(request: Request): Promise<boolean> {
    // Authentication is disabled - all requests are allowed
    return true;
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