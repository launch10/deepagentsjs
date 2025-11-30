import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../middleware/auth';
import { adsGraph } from '@graphs';
import { graphParams } from "@core";
import { streamLanggraph, fetchLanggraphHistory } from 'langgraph-ai-sdk';
import { Ads } from '@types';
import { type AdsLanggraphData } from '@state';

type Variables = {
  auth: AuthContext;
};

export const adsRoutes = new Hono<{ Variables: Variables }>();

const graph = adsGraph.compile({ ...graphParams, name: 'ads'});

adsRoutes.post('/stream', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  
  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: 'Missing required fields: messages, threadId' }, 400);
  }
  let stateObj = state || {};

  return await streamLanggraph<AdsLanggraphData>({ 
    graph: graph as any,
    messageSchema: Ads.structuredMessageSchemas,
    messages,
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...stateObj,
    },
  });
});

adsRoutes.get('/stream', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const threadId = c.req.query('threadId');

  if (!threadId) {
    return c.json({ error: 'Missing threadId' }, 400);
  }

  return await fetchLanggraphHistory<AdsLanggraphData>({
    graph: graph as any,
    messageSchema: Ads.structuredMessageSchemas,
    threadId,
  });
});

adsRoutes.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    graph: 'ads',
    timestamp: new Date().toISOString() 
  });
});
