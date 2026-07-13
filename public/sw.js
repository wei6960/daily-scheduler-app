self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "排程通知", body: event.data?.text() || "" };
  }
  const title = payload.title || "排程通知";
  const options = {
    body: payload.body || "",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: payload.tag || "daily-scheduler",
    data: { url: payload.url || "./" },
    requireInteraction: Boolean(payload.requireInteraction),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
