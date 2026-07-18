import type { MetadataRoute } from "next";

// App Router gera /manifest.webmanifest e injeta o <link rel="manifest">.
// display: "standalone" faz o atalho da tela inicial abrir em tela cheia,
// sem a barra do navegador, o que evita que a barra do app (☰ + avatar)
// seja coberta pela barra do navegador interno.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Morabilidade: Sistema de Gestão",
    short_name: "Morabilidade",
    description: "Painel administrativo interno da imobiliária Morabilidade.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#585a4f",
    theme_color: "#585a4f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
