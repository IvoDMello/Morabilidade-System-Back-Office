"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { relativo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import type { Opiniao, Perfil } from "@/types";

/**
 * Opiniões da equipe sobre a captação. Abrir a página marca tudo como lido
 * (upsert em opiniao_leitura). Quem ainda não tem perfil define o nome de
 * exibição inline, antes da primeira opinião.
 */
export function Opinioes({
  captacaoId,
  userId,
  opinioesIniciais,
  perfis,
}: {
  captacaoId: string;
  userId: string;
  opinioesIniciais: Opiniao[];
  perfis: Perfil[];
}) {
  const [opinioes, setOpinioes] = useState<Opiniao[]>(opinioesIniciais);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>(
    () => Object.fromEntries(perfis.map((p) => [p.user_id, p.nome]))
  );
  const meuNome = nomes[userId] ?? null;
  const [novoNome, setNovoNome] = useState("");

  // Abriu a captação = leu as opiniões dela.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("opiniao_leitura")
      .upsert(
        { user_id: userId, captacao_id: captacaoId, lido_em: new Date().toISOString() },
        { onConflict: "user_id,captacao_id" }
      )
      .then(() => {});
  }, [captacaoId, userId]);

  const nomeDe = useMemo(
    () => (autor: string) => nomes[autor] ?? "Alguém da equipe",
    [nomes]
  );

  async function salvarNome() {
    const nome = novoNome.trim();
    if (!nome) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("perfil")
      .upsert({ user_id: userId, nome }, { onConflict: "user_id" });
    if (error) {
      toast.error("Não foi possível salvar o nome.");
      return;
    }
    setNomes((m) => ({ ...m, [userId]: nome }));
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || !meuNome) return;
    setEnviando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("opiniao")
      .insert({ captacao_id: captacaoId, autor: userId, texto: t })
      .select()
      .single();
    setEnviando(false);
    if (error || !data) {
      toast.error("Não foi possível enviar a opinião.");
      return;
    }
    setOpinioes((l) => [...l, data as Opiniao]);
    setTexto("");
    // A própria opinião já nasce lida para quem escreveu.
    await supabase
      .from("opiniao_leitura")
      .upsert(
        { user_id: userId, captacao_id: captacaoId, lido_em: new Date().toISOString() },
        { onConflict: "user_id,captacao_id" }
      );
  }

  async function apagar(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("opiniao").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    setOpinioes((l) => l.filter((o) => o.id !== id));
  }

  return (
    <div className="space-y-4">
      {opinioes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ninguém opinou ainda. Seja a primeira pessoa a comentar esta captação.
        </p>
      ) : (
        <ul className="space-y-3">
          {opinioes.map((o) => {
            const nome = nomeDe(o.autor);
            const minha = o.autor === userId;
            return (
              <li key={o.id} className="flex items-start gap-2.5">
                <Avatar nome={nome} />
                <div className="min-w-0 flex-1 rounded-xl bg-[#f5f6f1] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-[#4a4d43]">
                      {nome}
                      {minha && <span className="ml-1 font-normal text-muted-foreground">(você)</span>}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativo(o.criado_em)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#2e302a]">{o.texto}</p>
                </div>
                {minha && (
                  <button
                    type="button"
                    onClick={() => apagar(o.id)}
                    title="Apagar minha opinião"
                    className="mt-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {meuNome ? (
        <div className="flex items-end gap-2.5">
          <Avatar nome={meuNome} />
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva sua opinião sobre esta captação…"
            rows={2}
            className="min-h-0 flex-1"
          />
          <Button onClick={enviar} disabled={enviando || !texto.trim()} size="icon" title="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-3">
          <p className="text-sm font-medium">Como você quer ser identificado?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Seu nome aparece junto das suas opiniões para o resto da equipe. Você define uma vez só.
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Ivo"
              maxLength={40}
            />
            <Button onClick={salvarNome} disabled={!novoNome.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
