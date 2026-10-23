import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import lighthouse from "lighthouse";

await mkdir("docs/evidence", { recursive: true });
const server = await preview({
  preview: { host: "127.0.0.1", port: 4174, strictPort: true },
});
let browser;
try {
  browser = await chromium.launch({ args: ["--remote-debugging-port=9223"] });
  const result = await lighthouse("http://127.0.0.1:4174", {
    port: 9223,
    output: ["json", "html"],
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  });
  await writeFile("docs/evidence/lighthouse-mobile.json", result.report[0]);
  await writeFile("docs/evidence/lighthouse-mobile.html", result.report[1]);
  const { categories, audits } = result.lhr;
  const scores = Object.fromEntries(
    Object.entries(categories).map(([key, value]) => [
      key,
      Math.round(value.score * 100),
    ]),
  );
  let jsGzip = 0;
  for (const name of await readdir("dist/assets")) {
    if (name.endsWith(".js"))
      jsGzip += gzipSync(await readFile(`dist/assets/${name}`)).length;
  }
  const metrics = {
    lighthouseVersion: result.lhr.lighthouseVersion,
    fetchTime: result.lhr.fetchTime,
    environment: result.lhr.environment,
    formFactor: result.lhr.configSettings.formFactor,
    throttling: result.lhr.configSettings.throttling,
    scores,
    lcpMs: audits["largest-contentful-paint"].numericValue,
    cls: audits["cumulative-layout-shift"].numericValue,
    jsGzipBytes: jsGzip,
  };
  await writeFile(
    "docs/evidence/performance-summary.json",
    JSON.stringify(metrics, null, 2),
  );
  console.log(metrics);
  if (
    scores.performance < 90 ||
    scores.accessibility < 95 ||
    scores["best-practices"] < 95 ||
    scores.seo < 90 ||
    metrics.lcpMs > 2500 ||
    metrics.cls > 0.1 ||
    jsGzip > 81920
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
