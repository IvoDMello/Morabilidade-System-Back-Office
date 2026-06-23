"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BoardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Não foi possível carregar o quadro</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Verifique sua conexão. Se o erro persistir, pode ser um problema temporário no servidor.
      </p>
      <Button onClick={reset}>
        <RotateCw className="h-4 w-4" /> Tentar novamente
      </Button>
    </main>
  );
}
