import { config } from "../src/config.js";
import { gallery } from "../src/gallery.js";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function contentPlugin() {
  return {
    name: "jc-static-content",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // The source HTML has a readable fallback. Config is authoritative in
        // development and builds, including with JavaScript disabled.
        const replacements = [
          ["JC Barberhouse", config.brandName],
          ["+54 9 3329 60-6138", config.whatsappDisplay],
          ["5493329606138", config.whatsappNumber],
          ["https://www.instagram.com/jc_barberhouse/", config.instagramUrl],
          ["@jc_barberhouse", `@${config.instagramHandle}`],
          ["https://www.tiktok.com/@jcbarberhouse?_r=1&amp;_t=ZS-9AfYPGAygh0", config.tiktokUrl],
          [
            "AVENIDA%20SAN%20MARTIN%20743%2C%20Baradero",
            encodeURIComponent(`${config.addressText}, ${config.addressCity}`),
          ],
          [
            "AVENIDA%20SAN%20MARTIN%20743",
            encodeURIComponent(config.addressText),
          ],
          [
            "AVENIDA SAN MARTIN 743, Baradero",
            `${config.addressText}, ${config.addressCity}`,
          ],
          ["AVENIDA SAN MARTIN 743", config.addressText],
          ["Corte de pelo a domicilio", config.service],
        ];
        for (const [source, value] of replacements)
          html = html.replaceAll(source, escape(value));
        html = html.replace("<strong>@jcbarberhouse</strong>", `<strong>@${escape(config.tiktokHandle)}</strong>`);
        const structured = {
          "@context": "https://schema.org",
          "@type": "HairSalon",
          name: config.brandName,
          telephone: config.whatsappDisplay,
          description: `${config.service}. Turnos sujetos a confirmación por WhatsApp.`,
          address: {
            "@type": "PostalAddress",
            streetAddress: config.addressText,
            addressLocality: config.addressCity,
            addressCountry: "AR",
          },
          sameAs: [config.instagramUrl, config.tiktokUrl],
        };
        html = html.replace(
          /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
          `<script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\\u003c")}</script>`,
        );
        const cards = gallery
          .map(({ stem, title, subtitle, caption, alt }) => {
            if (!/^[a-zA-Z0-9_-]+$/.test(stem))
              throw new Error("Invalid image stem");
            return `<figure class="cut-card"><a href="./images/${stem}-960.jpg" class="gallery-link" data-caption="${escape(caption)}" aria-label="Ampliar foto: ${escape(caption.toLocaleLowerCase("es-AR"))}"><picture><source type="image/webp" srcset="./images/${stem}-480.webp 480w, ./images/${stem}-960.webp 960w" sizes="(max-width: 480px) 82vw, (max-width: 760px) 33vw, 20vw"><img src="./images/${stem}-480.jpg" width="480" height="640" alt="${escape(alt)}" loading="lazy"></picture><span class="zoom-indicator" aria-hidden="true">＋</span></a><figcaption><span>${escape(title)}</span><small>${escape(subtitle)}</small></figcaption></figure>`;
          })
          .join("\n");
        return html.replace(
          /<!-- gallery:start -->[\s\S]*?<!-- gallery:end -->/,
          `<div class="gallery">${cards}</div>`,
        );
      },
    },
  };
}
