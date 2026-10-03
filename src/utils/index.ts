// src/utils/index.ts - Shared utilities

export class UrlUtils {
  /**
   * Decode a URL parameter that may be base64-encoded or plain
   */
  static decodeUrl(d: string | null): string | null {
    if (!d) return null;
    
    // Try plain URL first
    try {
      const decoded = decodeURIComponent(d);
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
    } catch {
      // Not URL-encoded
    }

    // Try base64
    try {
      const decoded = atob(d);
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
    } catch {
      // Not base64
    }

    return d;
  }

  /**
   * Check if a string is base64-encoded
   */
  static isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  /**
   * Extract custom headers from query params (h_<Name> pattern)
   */
  static extractCustomHeaders(url: URL): Record<string, string> {
    const headers: Record<string, string> = {};
    const hPrefix = 'h_';
    
    for (const [key, value] of url.searchParams) {
      if (key.startsWith(hPrefix)) {
        const headerName = key.slice(hPrefix.length).replace(/_/g, '-');
        headers[headerName] = value;
      }
    }
    
    return headers;
  }

  /**
   * Build a fetch options object with custom headers
   */
  static buildFetchOptions(
    method: string,
    customHeaders: Record<string, string>,
    extraHeaders: Record<string, string> = {}
  ): RequestInit {
    const headers = { ...customHeaders, ...extraHeaders };
    
    // Set sensible defaults
    if (!headers['User-Agent']) {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    
    return {
      method,
      headers,
      cf: {
        // Cloudflare-specific fetch options
        cacheTtl: 0,
        cacheEverything: false,
      } as any,
    };
  }

  /**
   * Apply transport routes to determine if traffic should be proxied
   */
  static shouldProxy(
    targetUrl: string,
    transportRoutes: any[]
  ): { proxy: boolean; proxyUrl?: string; verifySsl: boolean } {
    const url = new URL(targetUrl);
    const defaultResult = { proxy: false, verifySsl: true };
    
    if (!transportRoutes || transportRoutes.length === 0) {
      return defaultResult;
    }

    for (const route of transportRoutes) {
      const pattern = route.pattern;
      
      if (pattern.startsWith('all://')) {
        // Wildcard pattern
        const wildcard = pattern.replace('all://', '');
        if (this.matchesWildcard(url.host, wildcard)) {
          return {
            proxy: route.proxy ?? false,
            proxyUrl: route.proxy_url,
            verifySsl: route.verify_ssl ?? true,
          };
        }
      } else if (pattern.startsWith('https://') || pattern.startsWith('http://')) {
        // Exact URL match
        if (url.origin === new URL(pattern).origin) {
          return {
            proxy: route.proxy ?? false,
            proxyUrl: route.proxy_url,
            verifySsl: route.verify_ssl ?? true,
          };
        }
      }
    }

    return defaultResult;
  }

  private static matchesWildcard(host: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // .example.com
      return host.endsWith(suffix);
    }
    return host === pattern;
  }

  /**
   * Get remaining time for URL expiration
   */
  static getUrlExpiration(url: URL): number | null {
    const expiresParam = url.searchParams.get('expires');
    if (!expiresParam) return null;
    
    const expires = parseInt(expiresParam, 10);
    const now = Math.floor(Date.now() / 1000);
    
    if (expires < now) return null; // Expired
    
    return expires - now;
  }
}

/**
 * Metrics tracking (simplified)
 */
export class Metrics {
  static requestCount = 0;
  static bytesTransferred = 0;
  static errorCount = 0;
  static startTime = Date.now();

  static incrementRequest(): void {
    this.requestCount++;
  }

  static addBytes(bytes: number): void {
    this.bytesTransferred += bytes;
  }

  static incrementError(): void {
    this.errorCount++;
  }

  static getMetrics(): Record<string, any> {
    return {
      requests_total: this.requestCount,
      bytes_transferred_total: this.bytesTransferred,
      errors_total: this.errorCount,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}