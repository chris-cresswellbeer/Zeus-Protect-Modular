import { defineConfig } from "vite"; import react from "@vitejs/plugin-react";
import fs from "node:fs"; import path from "node:path";

// Gives the phone app's offline copy (public/sw.js) a new id on every build, so each
// release replaces the saved copy on phones by itself — no number to remember to change —
// and lists the release's files so they are all saved for use with no signal.
function zpStampServiceWorker() {
  let outDir = "dist";
  return {
    name: "zp-stamp-service-worker",
    apply: "build",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    closeBundle() {
      const f = path.join(outDir, "sw.js");
      if (!fs.existsSync(f)) return;
      const id = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 6);
      const assetsDir = path.join(outDir, "assets");
      const assets = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).filter(n => !/^pdf/.test(n) && !/\.map$/.test(n)).map(n => "/assets/" + n)
        : [];
      fs.writeFileSync(f, fs.readFileSync(f, "utf8")
        .replace(/__ZP_BUILD__/g, id)
        .replace("[] /*__ZP_ASSETS__*/", JSON.stringify(assets)));
    },
  };
}

// The pdf.js worker (used by Create Module → Import slides) ships as .mjs; it's renamed
// to .js so every host serves it with a JavaScript content type (browsers refuse to run
// a worker served as anything else).
export default defineConfig({
  plugins:[react(), zpStampServiceWorker()],
  build:{ rollupOptions:{ output:{ assetFileNames: a => /\.mjs$/.test(a.name || "") ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]" } } },
});
