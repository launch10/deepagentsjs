/**
 * Universal environment variable accessor for both frontend (Vite) and backend (Node.js)
 * 
 * Uses the standard pattern: import.meta?.env ?? process.env
 * 
 * Usage:
 * - Backend: Reads from process.env
 * - Frontend: Reads from import.meta.env (Vite - requires VITE_ prefix)
 */

// @ts-ignore
export const env = import.meta?.env ?? process.env;

export const isFrontend = () => typeof import.meta !== 'undefined' && 'env' in import.meta;
export const isBackend = () => !isFrontend();