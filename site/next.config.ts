import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Não exibe output de upload de source maps no CI
  silent: !process.env.CI,

  // Upload de source maps apenas em produção
  hideSourceMaps: true,

  // Remove o logger do Sentry do bundle de produção
  disableLogger: true,

  // Tunneling para contornar ad-blockers
  tunnelRoute: "/monitoring",

  // Desabilita o Sentry se DSN não estiver configurado (ex.: dev local sem .env)
  autoInstrumentServerFunctions: true,
});
