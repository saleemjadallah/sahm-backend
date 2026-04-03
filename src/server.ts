// Ensure fontconfig can find its config (needed by Sharp/PDFKit SVG text rendering)
import { accessSync } from "node:fs";
if (!process.env.FONTCONFIG_PATH) {
  for (const dir of ["/opt/homebrew/etc/fonts", "/usr/local/etc/fonts", "/etc/fonts"]) {
    try { accessSync(`${dir}/fonts.conf`); process.env.FONTCONFIG_PATH = dir; break; } catch {}
  }
}

import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

app
  .listen({
    host: "0.0.0.0",
    port: env.PORT,
  })
  .then(() => {
    app.log.info(`Sahm backend listening on ${env.PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
