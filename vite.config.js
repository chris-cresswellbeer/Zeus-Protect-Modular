import { defineConfig } from "vite"; import react from "@vitejs/plugin-react";
// The pdf.js worker (used by Create Module → Import slides) ships as .mjs; it's renamed
// to .js so every host serves it with a JavaScript content type (browsers refuse to run
// a worker served as anything else).
export default defineConfig({
  plugins:[react()],
  build:{ rollupOptions:{ output:{ assetFileNames: a => /\.mjs$/.test(a.name || "") ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]" } } },
});
