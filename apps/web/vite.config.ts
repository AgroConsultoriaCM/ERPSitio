import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Com o site na Vercel e a API na Oracle, as chamadas passam a ser para outra
// origem. Casar só pelo caminho ("/api/...") deixaria de identificar a API — e
// pior, casaria com qualquer outro serviço que use um caminho parecido. Por
// isso o service worker aprende, na compilação, o endereço real da API.
const API_URL = process.env.VITE_API_URL ?? "http://localhost:3333/api/v1";
const SEM_BARRA_FINAL = API_URL.replace(/\/+$/, "");

function escaparRegex(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Precisa ser expressão regular, não função: o Workbox copia esta regra para
// dentro do sw.js convertendo-a em texto, e uma função perde as variáveis de
// fora junto. A regex atravessa inteira.
const PADRAO_API = /^https?:\/\//i.test(API_URL)
  ? new RegExp("^" + escaparRegex(SEM_BARRA_FINAL)) // outra origem: casa a URL toda
  : new RegExp(escaparRegex(SEM_BARRA_FINAL)); // mesma origem: casa o caminho

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Sítio - Gestão de Fruticultura",
        short_name: "Sítio",
        description: "Lançamentos de campo e gestão da propriedade",
        theme_color: "#166534",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/campo",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: PADRAO_API,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              // Resposta de outra origem só entra no cache se tiver vindo
              // completa (status 200). Sem isto, uma resposta opaca de erro
              // seria guardada e servida como se fosse boa.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
