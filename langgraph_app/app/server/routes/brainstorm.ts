import { Hono } from 'hono';
import { authMiddleware, type AuthContext } from '../middleware/auth';
import { brainstormGraph } from '@graphs';
import { graphParams } from "@core";
import { streamLanggraph, fetchLanggraphHistory } from 'langgraph-ai-sdk';
import { Brainstorm } from '@types';
import { type BrainstormLanggraphData } from '@state';

type Variables = {
  auth: AuthContext;
};

export const brainstormRoutes = new Hono<{ Variables: Variables }>();

const graph = brainstormGraph.compile({ ...graphParams, name: 'brainstorm'});

brainstormRoutes.post('/stream', authMiddleware, async (c) => {
  // TODO: Ensure user has access to threadId in auth middleware
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  
  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: 'Missing required fields: messages, threadId' }, 400);
  }
  let stateObj = state || {};

  return await streamLanggraph<BrainstormLanggraphData>({ 
    graph: graph as any,
    messageSchema: Brainstorm.structuredMessageSchemas,
    messages,
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...stateObj,
    },
  });
});

brainstormRoutes.get('/stream', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const threadId = c.req.query('threadId');

  if (!threadId) {
    return c.json({ error: 'Missing threadId' }, 400);
  }

  return await fetchLanggraphHistory<BrainstormLanggraphData>({
    graph: graph as any,
    messageSchema: Brainstorm.structuredMessageSchemas,
    threadId,
  });
});

brainstormRoutes.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    graph: 'brainstorm',
    timestamp: new Date().toISOString() 
  });
});
