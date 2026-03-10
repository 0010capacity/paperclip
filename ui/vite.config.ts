import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import i18nextLoader from "@kainstar/vite-plugin-i18next-loader";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    i18nextLoader({
      paths: ["./src/locales"],
      namespaceResolution: "basename",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});
