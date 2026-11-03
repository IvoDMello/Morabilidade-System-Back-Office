import type { NextConfig } from "next";

// Mesmos cabeçalhos do painel (web/). O atendimento envia mensagens em nome da
// empresa: sem X-Frame-Options, outro site poderia carregá-lo num iframe e
// induzir cliques do atendente logado.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // VOZ.md é lido do disco em runtime (services/assistant/voz.ts). Como nada o
  // importa, o tracing do build não o enxerga e ele não subiria no deploy — sem
  // isto, produção cairia no fallback mínimo e o tom se perderia em silêncio.
  outputFileTracingIncludes: {
    "/*": ["VOZ.md"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
