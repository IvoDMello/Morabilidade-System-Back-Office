import { withSentryConfig } from "@sentry/nextjs";

// Mesmos cabeçalhos do painel (web/): nada aqui é para ser embutido em iframe.
// Câmera fica bloqueada porque as fotos entram por <input type="file">, que
// abre a câmera do sistema sem pedir essa permissão ao navegador.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // badge "N" do Next em dev ficava por cima da navegação inferior
  devIndicators: false,
  // thumbs já vêm comprimidos do cliente (WebP); não reotimizar (poupa cota Vercel)
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

// Sentry só em produção: em dev ele instrumenta o build e deixa a compilação lenta.
export default process.env.NODE_ENV === "production"
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
