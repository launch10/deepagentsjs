export function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken =
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "";
  const headers = new Headers(options.headers);
  if (!headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrfToken);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(url, { ...options, headers, credentials: "same-origin" });
}
