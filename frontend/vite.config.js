import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    VitePWA({
      registerType: "autoUpdate",
      // O manifest passa a ser gerado aqui; o public/manifest.json antigo foi
      // removido para não haver duas fontes divergentes.
      manifest: {
        name: "Unmess",
        short_name: "Unmess",
        description: "Atendimento via WhatsApp",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#2576d2",
        background_color: "#f7f8fa",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // O bundle passa de 1,7 MB; o padrão do Workbox (2 MB) deixaria de
        // fora justamente o arquivo principal.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Nada de API nem WebSocket em cache: são dados vivos, e servir
        // resposta velha de conversa seria pior que não abrir.
        navigateFallbackDenylist: [/^\/api/, /^\/public/, /^\/socket\.io/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/public/"),
            handler: "CacheFirst",
            options: {
              cacheName: "anexos",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      },
      devOptions: {
        // Desligado em desenvolvimento: service worker interceptando o
        // hot reload atrapalha mais do que ajuda.
        enabled: false
      }
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3001,
    open: true,
    // O Vite recusa requisições cujo cabeçalho Host não conste aqui. Além do
    // IP da rede, a instalação é acessada pelo nome da máquina no Windows e
    // pelo IP do Tailscale.
    allowedHosts: [
      "localhost",
      // Nome da máquina que hospeda a instalação. É por ele que os
      // computadores do escritório acessam, e não pelo IP: o IP muda quando a
      // máquina troca de rede Wi-Fi, o nome não.
      "unmess",
      "servidor",
      "192.168.1.200",
      "100.68.128.23",
    ],
    // HTTPS é o que torna a origem um "contexto seguro" e libera o microfone
    // nos computadores que acessam pelo IP da rede. Sem os certificados
    // gerados (node scripts/generate-certs.js), sobe em HTTP normalmente.
    https: (() => {
      const cert = resolve(__dirname, "../certs/server.crt");
      const key = resolve(__dirname, "../certs/server.key");
      if (!existsSync(cert) || !existsSync(key)) return false;
      return { cert: readFileSync(cert), key: readFileSync(key) };
    })(),
  },
  build: {
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "material-ui": [
            "@mui/material",
            "@mui/icons-material",
            "@mui/styles",
          ],
        },
      },
    },
  },
  envPrefix: "VITE_",
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    // O bloco `esbuild` acima vale para a transformação dos arquivos, mas não
    // para o scanner de dependências, que roda numa instância própria. Sem
    // isto, o scan quebra ao encontrar JSX em arquivo .js — o que só aparece
    // quando o cache de node_modules/.vite é recriado.
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
    include: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/styles",
      "@emotion/react",
      "@emotion/styled",
      // howler é CommonJS sem campo "module". Sem pré-bundling, o import()
      // dinâmico que use-sound faz devolve o namespace com Howl aninhado em
      // default, e "new mod.Howl(...)" quebra ao tocar a notificação.
      "howler",
      "use-sound",
    ],
    exclude: [],
  },
  resolve: {
    alias: {
      "jss-plugin-globalThis": "jss-plugin-global",
    },
  },
});
