"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Algo deu errado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O erro foi registrado. Tente recarregar a página.
          </p>
        </div>
      </body>
    </html>
  );
}
