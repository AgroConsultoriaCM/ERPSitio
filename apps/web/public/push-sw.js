// Carregado via workbox.importScripts (vite.config.ts) dentro do service
// worker gerado pelo Workbox - sem isso, o generateSW nao tem como expor
// listener de push. Fica separado do resto (que e gerado automaticamente)
// pra nao mexer em nada do cache/offline que ja funciona.

self.addEventListener("push", (event) => {
  let dados = { title: "Sítio", body: "" };
  try {
    dados = event.data.json();
  } catch {
    // payload sem JSON valido: mostra so o titulo padrao
  }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: dados.url ?? "/campo" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/campo";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
