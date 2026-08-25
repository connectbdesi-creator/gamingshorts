// Minimal service worker: only exists to receive Web Push events and show
// a notification. No offline caching/PWA behavior here — that's a
// separate concern CLAUDE.md's traffic strategy leaves as a later PWA
// install-prompt task.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "GameShorts", body: event.data.text() };
  }

  const { title = "GameShorts", body = "", url = "/", icon } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon",
      badge: "/icon",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
