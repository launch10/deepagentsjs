import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../middleware/auth';
import { adsGraph } from '@graphs';
import { graphParams } from "@core";
import { AdsBridge } from '@annotation';
import { Ads } from '@types';

type Variables = {
  auth: AuthContext;
};

export const adsRoutes = new Hono<{ Variables: Variables }>();

const graph = adsGraph.compile({ ...graphParams, name: 'ads'});
const AdsAPI = AdsBridge.bind(graph);

adsRoutes.post('/stream', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  
  const { messages, threadId, state } = body;

  if (!threadId) {
    return c.json({ error: 'Missing required field: threadId' }, 400);
  }
  let stateObj = state || {};

  try {
    return AdsAPI.stream({ 
      messages: messages || [],
      threadId,
      state: {
        threadId,
        jwt: auth.jwt,
        ...stateObj,
      },
    });
  } catch (error) {
    console.error('AdsAPI.stream error:', error);
    return c.json({ error: 'Stream failed', details: String(error) }, 500);
  }
});

adsRoutes.get('/stream', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const threadId = c.req.query('threadId');

  if (!threadId) {
    return c.json({ error: 'Missing threadId' }, 400);
  }
  
  const response = await AdsAPI.loadHistory(threadId);
  console.log(response);
  debugger;
  return response;
});

adsRoutes.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    graph: 'ads',
    timestamp: new Date().toISOString() 
  });
});
