import type { Env } from '~/types';
import type { Context, Next } from 'hono';

export const hmacMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Skip auth for health check
    if (c.req.path === '/health' || c.req.path === '/api/internal/health') {
      return next();
    }
    
    const timestamp = c.req.header('X-Timestamp');
    const signature = c.req.header('X-Signature');
    
    if (!timestamp || !signature) {
      return c.json({ error: 'Missing timestamp or signature' }, 401);
    }

    // Check timestamp freshness (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    const timeWindow = 300; // 5 minutes
    
    if (Math.abs(now - requestTime) > timeWindow) {
      return c.json({ error: 'Request timestamp too old or too far in future' }, 401);
    }

    // Get request body for signature verification
    const body = await c.req.text();
    
    const secret = c.env.ATLAS_API_SECRET;
    if (!secret) {
      console.error('ATLAS_API_SECRET not configured');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    try {
      const payload = `${timestamp}.${body}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payload);
      
      // Import key for HMAC
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Generate expected signature
      const expectedBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

      // Decode the received hex signature to bytes for constant-time comparison
      const receivedBytes = new Uint8Array(signature.length / 2);
      for (let i = 0; i < signature.length; i += 2) {
        receivedBytes[i / 2] = parseInt(signature.substring(i, i + 2), 16);
      }

      // Constant-time comparison to prevent timing attacks
      // timingSafeEqual is available in Cloudflare Workers runtime
      const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean };
      const expectedBytes = new Uint8Array(expectedBuffer);
      if (receivedBytes.length !== expectedBytes.length ||
          !subtle.timingSafeEqual(receivedBytes, expectedBytes)) {
        console.warn('Invalid HMAC signature received');
        return c.json({ error: 'Invalid signature' }, 401);
      }
      
    } catch (error) {
      console.error('HMAC verification failed:', error);
      return c.json({ error: 'Signature verification failed' }, 500);
    }
    
    return next();
};