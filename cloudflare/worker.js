/**
 * Bedrock Cloudflare Edge Worker
 * Provides Edge DDoS filtering, WAF rules, Static Asset Caching, and Security Header Injection
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // =================== 1. Edge WAF & Scanner Blocking ===================
    const userAgent = request.headers.get('user-agent') || '';
    const badScanners = ['sqlmap', 'nikto', 'nmap', 'masscan', 'gobuster', 'dirbuster'];
    if (badScanners.some((bot) => userAgent.toLowerCase().includes(bot))) {
      return new Response('Access Denied by Bedrock Edge Firewall', { status: 403 });
    }

    // Check query string for obvious injection patterns
    const query = url.search.toLowerCase();
    if (
      query.includes('<script') ||
      query.includes('javascript:') ||
      query.includes('union+select') ||
      query.includes('concat(') ||
      query.includes('../')
    ) {
      return new Response('Malicious query parameter detected', { status: 400 });
    }

    // =================== 2. Static Asset Edge Caching ===================
    const isStaticAsset =
      url.pathname.startsWith('/assets/') ||
      url.pathname.match(/\.(css|js|woff2|woff|png|jpg|svg|ico)$/);

    if (isStaticAsset && request.method === 'GET') {
      const cache = caches.default;
      let cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      const originResponse = await fetch(request);
      if (originResponse.status === 200) {
        const responseClone = new Response(originResponse.body, originResponse);
        responseClone.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        ctx.waitUntil(cache.put(request, responseClone.clone()));
        return responseClone;
      }
      return originResponse;
    }

    // =================== 3. API & Dynamic Request Proxying ===================
    // Forward to origin server with client IP preserving
    const originResponse = await fetch(request);

    // Clone response to attach security headers
    const secureResponse = new Response(originResponse.body, originResponse);

    // Inject hardened security headers at the Edge
    secureResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    secureResponse.headers.set('X-Content-Type-Options', 'nosniff');
    secureResponse.headers.set('X-Frame-Options', 'DENY');
    secureResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    secureResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    secureResponse.headers.delete('x-powered-by');
    secureResponse.headers.delete('server');

    return secureResponse;
  },
};
