import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
