"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Algo deu errado</h1>
          <p style={{ color: "#525252", maxWidth: 400 }}>
            Tivemos um problema inesperado. Tente novamente.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#171717",
              color: "white",
              padding: "8px 16px",
              borderRadius: 6,
              border: 0,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
