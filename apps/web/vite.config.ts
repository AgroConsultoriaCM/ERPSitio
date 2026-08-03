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
        // "id" fixo evita que o Android trate o app como outro app quando a
        // start_url mudar — sem ele, o ícone instalado pode duplicar.
        id: "/?app=erpsitio",
        name: "Sítio - Gestão de Fruticultura",
        short_name: "Sítio",
        description: "Lançamentos de campo e gestão da propriedade",
        lang: "pt-BR",
        dir: "ltr",
        theme_color: "#166534",
        background_color: "#ffffff",
        display: "standalone",
        // O celular do encarregado é usado de pé, com uma mão só.
        orientation: "portrait",
        scope: "/",
        start_url: "/campo",
        categories: ["business", "productivity", "utilities"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
        // Atalhos do toque longo no ícone, no Android: leva direto ao
        // lançamento, sem passar pela home do app.
        shortcuts: [
          {
            name: "Registrar colheita",
            short_name: "Colheita",
            url: "/campo/colheita",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Nova operação",
            short_name: "Operação",
            url: "/campo/nova",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        // O celular do encarregado nunca abre o painel. Sem esta exclusão o
        // service worker baixaria mapa, gráficos e o leitor de planilhas
        // (≈975 kB) na instalação, gastando franquia de dados com tela que
        // ele não usa — "Adicionar análise" é só de gestão (SomenteGestao) e
        // carrega a biblioteca xlsx, pesada sozinha. No navegador do
        // escritório eles continuam carregando normalmente, pela rede.
        globIgnores: ["**/mapa-*.js", "**/graficos-*.js", "**/AdicionarAnalise-*.js"],
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
              // Sem teto, o cache cresce indefinidamente no aparelho do campo.
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Imagem de satélite do mapa: pesada e imutável. Guardar o que já
            // foi visto evita baixar de novo cada vez que a tela do talhão
            // abre — e faz o mapa funcionar offline na área já visitada.
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mapa-satelite",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // O pacote único passava de 1 MB. Separar o que só o painel usa faz a
        // tela de campo — a que abre no celular, muitas vezes em 3G — carregar
        // sem esperar o mapa e os gráficos.
        manualChunks: {
          mapa: ["leaflet", "react-leaflet", "leaflet-draw", "@turf/area", "@turf/boolean-within"],
          graficos: ["recharts"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
