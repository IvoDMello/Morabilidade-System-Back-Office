import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CaptacaoNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Captação não encontrada</h1>
      <p className="text-sm text-muted-foreground">Ela pode ter sido excluída.</p>
      <Button variant="outline" asChild>
        <Link href="/board">
          <ArrowLeft className="h-4 w-4" /> Voltar ao quadro
        </Link>
      </Button>
    </main>
  );
}
