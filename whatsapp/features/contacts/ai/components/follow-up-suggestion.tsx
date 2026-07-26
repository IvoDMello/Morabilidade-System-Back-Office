"use client";

import { useState, useTransition } from "react";
import { Copy, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateFollowUpAction, sendMessageAction } from "@/app/conversas/actions";
import type { ID } from "@/types/common";

export function FollowUpSuggestion({ contactId }: { contactId: ID }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();

  function handleGenerate() {
    startGenerating(async () => {
      try {
        const text = await generateFollowUpAction(contactId);
        setSuggestion(text);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível gerar a sugestão.",
        );
      }
    });
  }

  async function handleCopy() {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  }

  function handleSend() {
    if (!suggestion) return;
    startSending(async () => {
      try {
        await sendMessageAction(contactId, { body: suggestion });
        toast.success("Mensagem enviada.");
        setSuggestion(null);
      } catch {
        toast.error("Não foi possível enviar a mensagem.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestion ? (
        <>
          <Textarea
            rows={4}
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            <Button size="sm" loading={isSending} onClick={handleSend}>
              {!isSending && <Send className="h-3.5 w-3.5" />}
              Enviar agora
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Este contato está sem interação há um tempo. Gere uma sugestão de mensagem
            personalizada para retomar o contato.
          </p>
          <Button
            variant="outline"
            size="sm"
            loading={isGenerating}
            onClick={handleGenerate}
            className="self-start"
          >
            {!isGenerating && <Sparkles className="h-3.5 w-3.5" />}
            Gerar sugestão
          </Button>
        </>
      )}
    </div>
  );
}
