import type { Context, Next } from 'hono';
import { env } from '@core';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  sub: string;
  exp: number;
  iat: number;
  jti: string;
}

export interface AuthContext {
  accountId: number;
  jwtToken: string;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    
    console.log(decoded)
    c.set('auth', {
      accountId: Number(decoded.sub),
      jwtToken: token,
    } as AuthContext);

    // TODO: Ensure user has access to threadId
    // Remake auth context as yes/no authorized

    await next();
  } catch (error) {
    console.log(error)
    if (error instanceof jwt.TokenExpiredError) {
      return c.json({ error: 'Unauthorized: Token expired' }, 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }
};
