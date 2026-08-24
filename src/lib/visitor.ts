const VISITOR_ID_KEY = "gs_visitor_id";

/**
 * Anonymous per-browser identity used to dedupe likes without requiring a
 * login (CLAUDE.md's "lightweight user identity"). Persisted in
 * localStorage; regenerated per-browser, so it's not a durable identity —
 * clearing site data or switching devices resets it.
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}
