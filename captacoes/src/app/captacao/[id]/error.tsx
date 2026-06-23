"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CaptacaoError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Erro ao abrir a captação</h1>
      <div className="flex gap-2">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button variant="outline" asChild>
          <Link href="/board">
            <ArrowLeft className="h-4 w-4" /> Voltar ao quadro
          </Link>
        </Button>
      </div>
    </main>
  );
}
