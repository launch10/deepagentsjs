import { cors } from 'hono/cors';

export const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return null;
      
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://launch10.ai',
        'https://www.launch10.ai'
      ];
      
      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Timestamp', 'X-Signature'],
    credentials: true,
});
