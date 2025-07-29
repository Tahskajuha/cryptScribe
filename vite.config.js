import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { SocksProxyAgent } from "socks-proxy-agent";
import testEnv from "./test100.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: "./frontend",
  build: {
    outDir: "./public",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, "frontend/app.html"),
        gate: resolve(__dirname, "frontend/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/void": {
        target: testEnv,
        changeOrigin: true,
        secure: false,
        agent: new SocksProxyAgent("socks5h://127.0.0.1:9050"),
      },
    },
  },
});
