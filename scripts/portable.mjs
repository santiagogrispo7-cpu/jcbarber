import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";

const output = resolve(process.argv[2] || "dist");
let html = await readFile(resolve(output, "index.html"), "utf8");
const jsTag = html.match(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/,
);
const cssTags = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)];
if (!jsTag || !cssTags.length)
  throw new Error("Unexpected Vite output: could not create portable HTML.");
// Multipage builds share modules. Bundle their complete graph for file:// use.
const bundle = await rolldown({ input: resolve(output, jsTag[1]) });
const generated = await bundle.generate({ format: "iife", inlineDynamicImports: true });
await bundle.close();
const js = generated.output.find((item) => item.type === "chunk").code;
html = html.replace(jsTag[0], "").replace(/<link rel="modulepreload"[^>]*>/g, "");
for (const cssTag of cssTags) {
  const css = await readFile(resolve(output, cssTag[1]), "utf8");
  html = html.replace(cssTag[0], `<style>${css.replaceAll("</style", "<\\/style")}</style>`);
}
html = html.replace(
  "</head>",
  '<meta name="robots" content="noindex,follow"></head>',
);
html = html.replace(
  "</body>",
  `<script>${js.replaceAll("</script", "<\\/script")}</script></body>`,
);
await writeFile(resolve(output, "jc-barberhouse.html"), html);
console.log(
  `Portable page: ${resolve(output, "jc-barberhouse.html")} (open directly; keep images/ alongside).`,
);
