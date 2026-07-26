"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { generateSummaryAction } from "@/app/contatos/actions";
import type { ID } from "@/types/common";
import type { ContactAiSummary } from "@/types/ai-summary";

const FIELDS: { key: keyof ContactAiSummary; label: string }[] = [
  { key: "objetivo", label: "Objetivo do cliente" },
  { key: "orcamento", label: "Orçamento" },
  { key: "localizacao", label: "Localização desejada" },
  { key: "estagio", label: "Estágio atual" },
  { key: "proximosPassos", label: "Próximos passos" },
];

export function AiSummaryCard({
  contactId,
  summary,
  generatedAt,
}: {
  contactId: ID;
  summary: ContactAiSummary | null;
  generatedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      try {
        await generateSummaryAction(contactId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível gerar o resumo.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {summary ? (
        <dl className="flex flex-col gap-2 text-sm">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap">{summary[key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Gere um resumo automático a partir da conversa e das anotações deste contato.
        </p>
      )}

      {generatedAt && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Gerado em {formatDateTime(generatedAt)}
          </p>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        loading={isPending}
        onClick={handleGenerate}
        className="self-start"
      >
        {!isPending && <Sparkles className="h-3.5 w-3.5" />}
        {summary ? "Atualizar resumo" : "Gerar resumo"}
      </Button>
    </div>
  );
}
