import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Headers conservadores — sem CSP por enquanto pra não quebrar Sentry/loader
// custom de imagens no go-live. CSP entra depois com tempo de testar.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Loader custom roteia fotos do Supabase pro endpoint de transformação
    // nativa (render/image/public). Tira a Vercel do meio — estávamos
    // estourando a cota grátis de Image Optimization (erro 402).
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
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
  sourcemaps: {
    disable: true,
  },

  // Remove o logger do Sentry do bundle de produção
  disableLogger: true,

  // Tunneling para contornar ad-blockers
  tunnelRoute: "/monitoring",

  // Desabilita o Sentry se DSN não estiver configurado (ex.: dev local sem .env)
  autoInstrumentServerFunctions: true,
});
