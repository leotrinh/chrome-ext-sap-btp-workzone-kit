import { build } from "vite";
import react from "@vitejs/plugin-react";
import { rmSync, mkdirSync, cpSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { findRootAbsoluteAssetRefs } from "./sidepanel-html-guard.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(rootDir, "dist");

function clean() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

async function buildSidepanel() {
  await build({
    root: resolve(rootDir, "src/sidepanel"),
    base: "./",
    plugins: [react()],
    build: {
      outDir: resolve(distDir, "sidepanel"),
      emptyOutDir: true,
    },
  });

  const indexHtmlPath = resolve(distDir, "sidepanel/index.html");
  const badRefs = findRootAbsoluteAssetRefs(readFileSync(indexHtmlPath, "utf-8"));
  if (badRefs.length > 0) {
    throw new Error(
      `dist/sidepanel/index.html has root-absolute asset references that will 404 ` +
        `under chrome-extension://<id>/sidepanel/: ${badRefs.join(", ")}. ` +
        `Check the sidepanel build's "base" option.`,
    );
  }
}

/**
 * Background service worker and the content-script bundle must ship as a single
 * self-contained bundle each — no runtime `import` of anything outside the package,
 * no CDN scripts (blueprint §37).
 */
async function buildScript(entry, outputName, format) {
  await build({
    root: rootDir,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, entry),
        formats: [format],
        name: "BtpWorkzoneKit",
        fileName: () => outputName,
      },
      rollupOptions: {
        output: format === "iife" ? { extend: true } : {},
      },
    },
  });
}

function copyPublicAssets() {
  cpSync(resolve(rootDir, "public/manifest.json"), resolve(distDir, "manifest.json"));
  cpSync(resolve(rootDir, "public/icons"), resolve(distDir, "icons"), { recursive: true });
}

async function main() {
  clean();
  await buildSidepanel();
  await buildScript("src/background/service-worker.ts", "service-worker.js", "es");
  await buildScript("src/content/index.ts", "content-script.js", "iife");
  copyPublicAssets();
  console.log("Build complete: dist/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
