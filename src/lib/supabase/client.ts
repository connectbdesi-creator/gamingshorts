import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClientPromise: Promise<SupabaseClient<Database>> | undefined;

/**
 * Browser-side Supabase client for likes/comments/follows (Phase 4).
 * Lazily instantiated and memoized so client components can call this
 * repeatedly without spinning up multiple realtime connections.
 *
 * @supabase/supabase-js is dynamically imported here rather than at module
 * top-level — LikeButton renders on every grid card, so a static import
 * put the full library in the JS bundle needed just to hydrate the
 * homepage grid, even though the client is only ever used inside a
 * useEffect/click handler (after mount, not before). That widened the
 * window between "page visually tappable" and "click handlers actually
 * attached," which showed up as a real bug: a tap landing in that window
 * fell through to the underlying <Link>'s href and did a full page
 * navigation instead of opening the swipe reader (confirmed with
 * Playwright — tapping before hydration completes reproduces it every
 * time). Deferring this import shrinks that window; it doesn't close it
 * entirely, but it's the biggest lever available without changing what
 * the grid actually renders.
 */
export async function getSupabaseBrowserClient(): Promise<SupabaseClient<Database>> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }

  if (!browserClientPromise) {
    browserClientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient<Database>(supabaseUrl, supabaseAnonKey)
    );
  }

  return browserClientPromise;
}
