self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "Bariloche";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    data: {
      url: typeof payload.url === "string" && payload.url ? payload.url : "#/home",
      type: typeof payload.type === "string" ? payload.type : "general",
    },
    icon: "images/Gio.JPG",
    badge: "images/Gio.JPG",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "#/home";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "push:navigate", url: target });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(new URL(target, self.location.origin).href);
      }
      return undefined;
    })
  );
});
