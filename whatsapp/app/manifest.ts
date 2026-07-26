import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WhatsApp Morabilidade",
    short_name: "WhatsApp Morabilidade",
    description: "CRM de atendimento via WhatsApp para operação imobiliária",
    start_url: "/",
    display: "standalone",
    background_color: "#14160f",
    theme_color: "#10120b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Variantes full-bleed: sem elas o Android põe o ícone sobre um círculo
      // branco na splash/launcher antes de aplicar a máscara do sistema.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
