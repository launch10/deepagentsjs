import { cors } from 'hono/cors';

// Read port from env (set by config/services.sh), default to 3000 for dev
const railsPort = process.env.RAILS_PORT || '3000';

export const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return null;

      const allowedOrigins = [
        `http://localhost:${railsPort}`,
        `http://127.0.0.1:${railsPort}`,
        'https://launch10.com',
        'https://www.launch10.com'
      ];

      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Timestamp', 'X-Signature'],
    credentials: true,
});
