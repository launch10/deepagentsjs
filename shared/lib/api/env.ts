/**
 * Universal environment variable accessor for both frontend (Vite) and backend (Node.js)
 *
 * Uses the standard pattern: import.meta?.env ?? process.env
 *
 * Usage:
 * - Backend: Reads from process.env
 * - Frontend: Reads from import.meta.env (Vite - requires VITE_ prefix)
 */

interface EnvVars {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  RAILS_API_URL?: string;
  VITE_RAILS_API_URL?: string;
  [key: string]: string | undefined;
}

// @ts-ignore - import.meta.env may not exist in Node.js context
export const env: EnvVars = import.meta?.env ?? process.env;

// Check if running in browser (frontend) vs Node.js (backend/tests)
export const isFrontend = () => {
  try {
    // @ts-ignore
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  } catch {
    return false;
  }
};
export const isBackend = () => !isFrontend();