import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
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
            "@material-ui/core",
            "@material-ui/icons",
            "@material-ui/lab",
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
      "@material-ui/core",
      "@material-ui/icons",
      "@material-ui/lab",
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
