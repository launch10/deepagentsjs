// Cloudflare Workers doesn't support AsyncLocalStorage from node:async_hooks
// So we'll use a simpler approach with a request-scoped context

interface RequestContext {
  requestId: string;
  method: string;
  path: string;
}

// In Cloudflare Workers, we'll pass context through middleware
let currentContext: RequestContext | undefined;

export const setRequestContext = (context: RequestContext) => {
  currentContext = context;
};

export const getRequestContext = (): RequestContext | undefined => {
  return currentContext;
};

export const clearRequestContext = () => {
  currentContext = undefined;
};

// For compatibility with existing code that might use getRequest
export const getRequest = getRequestContext;