import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getVisitorId } from "@/lib/visitor";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i);
  return array;
}

/**
 * Requests notification permission, registers the service worker, and
 * subscribes to Web Push — storing the subscription in `push_subscriptions`
 * (see supabase/migrations/0002_create_games_and_push.sql) keyed by the
 * anonymous visitor id so scripts/ingest/push.ts can find it later.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY and Supabase to both be
 * configured; throws with a descriptive message otherwise so callers can
 * show that to the user instead of failing silently.
 */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error("Push notifications aren't configured yet (missing VAPID key).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }

  const supabase = await getSupabaseBrowserClient();
  const { error } = await supabase.from("push_subscriptions").insert({
    visitor_id: getVisitorId(),
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
  if (error) throw error;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  try {
    const supabase = await getSupabaseBrowserClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    // Supabase not configured — the browser-side unsubscribe above still
    // took effect, which is what matters most to the user.
  }
}
