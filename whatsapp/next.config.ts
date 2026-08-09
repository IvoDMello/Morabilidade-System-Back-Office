import type { NextConfig } from "next";

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
