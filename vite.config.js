import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "./webApp/frontend",
  build: {
    outDir: "./webApp/public",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        auth: resolve(__dirname, "frontend/auth.html"),
        app: resolve(__dirname, "frontend/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/void": "http://localhost:3000",
    },
  },
});
