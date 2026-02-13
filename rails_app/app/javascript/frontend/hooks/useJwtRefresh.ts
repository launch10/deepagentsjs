import { useEffect, useRef } from "react";
import { useSessionStore } from "~/stores/sessionStore";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Decode a JWT's payload without verifying the signature (client-side check only).
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired or will expire within the given buffer (in ms).
 */
function isJwtExpiredOrExpiring(token: string, bufferMs: number = 5 * 60 * 1000): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // Can't determine — treat as expired
  const expiresAtMs = payload.exp * 1000;
  return Date.now() + bufferMs >= expiresAtMs;
}

/**
 * Proactive JWT refresh hook. Call once in SiteLayout.
 *
 * Refreshes the JWT:
 * 1. On a 30-minute interval
 * 2. When the tab becomes visible (handles sleep/wake)
 * 3. When the current JWT is expired or about to expire (within 5 min)
 *
 * Uses the Devise session cookie (not the JWT itself) to authenticate,
 * so this works even when the JWT has already expired.
 */
export function useJwtRefresh() {
  const rootPath = useSessionStore((s) => s.rootPath);
  const setSession = useSessionStore((s) => s.set);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!rootPath) return;

    const refresh = async () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        const res = await fetch(`${rootPath}/api/v1/jwt`, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (res.ok) {
          const { jwt: newJwt } = await res.json();
          if (newJwt) setSession({ jwt: newJwt });
        } else if (res.status === 401) {
          window.location.href = "/users/sign_in";
        }
      } catch (e) {
        console.warn("[useJwtRefresh] Failed:", e);
      } finally {
        refreshingRef.current = false;
      }
    };

    // Check immediately if current JWT is expired or expiring soon
    const currentJwt = useSessionStore.getState().jwt;
    if (currentJwt && isJwtExpiredOrExpiring(currentJwt)) {
      refresh();
    }

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

    // Also refresh when tab becomes visible (handles sleep/wake)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [rootPath, setSession]);
}
