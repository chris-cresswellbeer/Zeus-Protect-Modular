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

// Another company's site (not Zeus): set on Netlify for that site only —
//   PORTAL_NEUTRAL=1          plain shield icons (brand-neutral/) instead of the Zeus ones
//   PORTAL_APP_NAME=Acme Safety   the app name on phones' home screens and install prompts
// Everything else (names, logos, colours) is set in the portal: Site Settings → Branding.
function zpSiteIdentity() {
  let outDir = "dist", root = ".";
  return {
    name: "zp-site-identity",
    apply: "build",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); root = c.root; },
    closeBundle() {
      const neutral = process.env.PORTAL_NEUTRAL === "1";
      const name = String(process.env.PORTAL_APP_NAME || (neutral ? "H&S Portal" : "")).trim();
      if (neutral) {
        const src = path.join(root, "brand-neutral");
        for (const f of ["favicon.ico", "favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon-180.png"]) {
          if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(outDir, f));
        }
      }
      const mf = path.join(outDir, "manifest.webmanifest");
      if (name && fs.existsSync(mf)) {
        const m = JSON.parse(fs.readFileSync(mf, "utf8"));
        Object.assign(m, { name, short_name: name.slice(0, 24), description: `${name} – health & safety portal` });
        fs.writeFileSync(mf, JSON.stringify(m, null, 2));
      }
    },
  };
}

// The pdf.js worker (used by Create Module → Import slides) ships as .mjs; it's renamed
// to .js so every host serves it with a JavaScript content type (browsers refuse to run
// a worker served as anything else).
export default defineConfig({
  plugins:[react(), zpStampServiceWorker(), zpSiteIdentity()],
  build:{ rollupOptions:{ output:{ assetFileNames: a => /\.mjs$/.test(a.name || "") ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]" } } },
});
