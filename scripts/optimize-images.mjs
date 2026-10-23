import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { gallery } from "../src/gallery.js";

const output = resolve("public/images");
await mkdir(output, { recursive: true });
for (const { stem } of gallery) {
  const source = `${stem}.jpeg`;
  const metadata = await sharp(source).metadata();
  console.log(
    `${source}: ${metadata.width}×${metadata.height}, orientation ${metadata.orientation || 1}`,
  );
  for (const width of [480, 960]) {
    const pipeline = sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true });
    await pipeline
      .clone()
      .webp({ quality: 78, effort: 5 })
      .toFile(resolve(output, `${stem}-${width}.webp`));
    await pipeline
      .clone()
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(resolve(output, `${stem}-${width}.jpg`));
  }
}
// Remove only the white margin of the provided logo; retain its original lettering.
await sharp("logo.jpg")
  .trim({ threshold: 25 })
  .jpeg({ quality: 95 })
  .toFile(resolve(output, "logo.jpg"));
await sharp("logo.jpg")
  .resize(64, 64)
  .png()
  .toFile(resolve(output, "favicon.png"));
console.log(
  `Hero WebP: ${Math.round((await stat(resolve(output, "corte2-960.webp"))).size / 1024)} KB`,
);
