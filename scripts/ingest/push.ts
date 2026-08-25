import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getSiteUrl } from "@/lib/site";
import type { Database } from "@/lib/supabase/types";
import type { Card } from "@/types/card";

/**
 * Sends a push notification to everyone following a new card's game.
 * Runs server-side only (the ingestion script, via GitHub Actions) since
 * it needs the VAPID private key and the Supabase service-role key —
 * neither of which the browser client (src/lib/supabase/client.ts) ever
 * sees. Skipped entirely (logged, not thrown) if any required env var is
 * missing, so a repo that hasn't configured push yet doesn't fail
 * ingestion over it.
 */
export async function sendPushForNewCards(cards: Card[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  const gameCards = cards.filter((c): c is Card & { game: string; game_label: string } =>
    Boolean(c.game && c.game_label)
  );
  if (gameCards.length === 0) return;

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.log(
      "  (skipping push notifications — Supabase service role or VAPID env vars not set)"
    );
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  for (const card of gameCards) {
    const { data: followers, error: followError } = await supabase
      .from("game_follows")
      .select("visitor_id")
      .eq("game_slug", card.game);

    if (followError || !followers || followers.length === 0) continue;

    const visitorIds = followers.map((f) => f.visitor_id);
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("visitor_id", visitorIds);

    if (subError || !subscriptions || subscriptions.length === 0) continue;

    const payload = JSON.stringify({
      title: `${card.game_label}: new update`,
      body: card.headline,
      url: `${getSiteUrl()}/news/${card.slug}`,
    });

    console.log(`  -> notifying ${subscriptions.length} follower(s) of "${card.game_label}"`);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired/revoked on the browser side — clean it up.
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error(`  ! Push send failed for subscription ${sub.id}:`, err);
        }
      }
    }
  }
}
