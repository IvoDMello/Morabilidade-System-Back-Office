"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProposalCard, type PropostaStatus } from "./proposal-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  analisarConversaAction,
  dispensarPropostaAction,
  executarAcaoDaConversaAction,
  registrarCaptacaoEncaminhadaAction,
  type AnaliseResultado,
} from "@/app/conversas/copilot-actions";
import { linkNovaCaptacao, rascunhoDaProposta } from "@/lib/captacao-link";
import type { CaptacaoResumo } from "@/services/captacoes.service";
import type { AgentProposal } from "@/types/agent-proposal";

/** O `status` do servidor é sempre "pendente" aqui (só pendentes chegam à tela),
 * então trocamos pelo estado de UI do cartão compartilhado. */
interface Item extends Omit<AgentProposal, "status"> {
  status: PropostaStatus;
}

function paraItens(propostas: AgentProposal[]): Item[] {
  return propostas.map((p) => ({ ...p, status: { kind: "pending" } }));
}

/** URL do cartão no board de captações (app irmão); null se o board não estiver
 * configurado (`CAPTACOES_BOARD_URL`). */
function linkDaCaptacao(captacoesUrl: string | null, id: string): string | null {
  return captacoesUrl ? `${captacoesUrl.replace(/\/$/, "")}/captacao/${id}` : null;
}

/**
 * Abre o formulário do board numa aba nova. Chamado direto do clique (nunca
 * depois de um await), senão o navegador trata como popup e bloqueia.
 */
function abrirNoBoard(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}

interface ConversationCopilotProps {
  contactId: string;
  contactName: string;
  contactPhone: string;
  captacoesContato: CaptacaoResumo[];
  captacoesRecentes: CaptacaoResumo[];
  /** URL do board de captações (abre em nova aba); null se não configurada. */
  captacoesUrl: string | null;
  /** Propostas pré-computadas quando a mensagem chegou — o trabalho que o
   * agente já adiantou. Vêm prontas do servidor; ninguém precisa clicar. */
  propostasPendentes: AgentProposal[];
}

/** Painel do copiloto dentro da conversa (CV — captações): mostra as captações
 * ligadas ao contato, permite criar uma nova sem sair do chat e aciona a IA
 * para analisar a conversa — que propõe captação/visita/resposta, sempre com
 * confirmação humana (e edição, no caso da resposta) antes de executar. */
export function ConversationCopilot({
  contactId,
  contactName,
  contactPhone,
  captacoesContato,
  captacoesRecentes,
  captacoesUrl,
  propostasPendentes,
}: ConversationCopilotProps) {
  // Semeado com o que o agente já adiantou: ao abrir o painel o trabalho está
  // feito, sem clique e sem espera. Reanalisar substitui a lista.
  const [items, setItems] = useState<Item[]>(() => paraItens(propostasPendentes));
  const [erro, setErro] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  function analisar() {
    setErro(null);
    startAnalyzing(async () => {
      const res: AnaliseResultado = await analisarConversaAction(contactId);
      setItems(paraItens(res.propostas));
      if (!res.ok || res.propostas.length === 0) setErro(res.erro ?? "Nenhuma ação sugerida.");
    });
  }

  function confirmar(idx: number, textoFinal: string | null) {
    const item = items[idx];
    const args = textoFinal === null ? item.args : { ...item.args, texto: textoFinal };

    // Captação não é executada aqui: vai para o formulário completo do board,
    // que é onde ela ganha bairro, valores, fotos e a checagem de duplicadas.
    // O cartão só existe depois que alguém confirmar lá.
    if (item.tool === "criar_captacao") {
      const href = linkNovaCaptacao(captacoesUrl, rascunhoDaProposta(args));
      if (!href) {
        toast.error("Board de captações não configurado (CAPTACOES_BOARD_URL).");
        return;
      }
      abrirNoBoard(href);
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? { ...it, status: { kind: "done", message: "Aberto no board para você completar." } }
            : it,
        ),
      );
      void registrarCaptacaoEncaminhadaAction(item.id);
      return;
    }

    setExecutingIdx(idx);
    // `textoSugerido` vai junto para o servidor saber se o texto foi editado —
    // é essa diferença que ensina a voz da casa ao agente.
    executarAcaoDaConversaAction(
      contactId,
      item.tool,
      args,
      item.id,
      item.textoSugerido,
    ).then((res) => {
      setExecutingIdx(null);
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                status: res.ok
                  ? { kind: "done", message: res.message }
                  : { kind: "error", message: res.message },
              }
            : it,
        ),
      );
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function dispensar(idx: number) {
    const item = items[idx];
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: { kind: "dismissed" } } : it)));
    // Descartar também é sinal de treino: registra que a proposta não servia.
    void dispensarPropostaAction(item.id);
  }


  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Copiloto</span>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Copiloto da conversa
          </SheetTitle>
          <SheetDescription>
            Captações e ações com IA para {contactName}. Nada é enviado ou criado sem a sua
            confirmação.
          </SheetDescription>
        </SheetHeader>

        {/* Ações fixas */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={analisar} loading={isAnalyzing} size="sm">
            <Sparkles className="h-3.5 w-3.5" />
            Analisar conversa
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Nova captação
          </Button>
        </div>

        {showForm && (
          <NovaCaptacaoForm
            contactName={contactName}
            contactPhone={contactPhone}
            captacoesUrl={captacoesUrl}
            onEncaminhada={() => setShowForm(false)}
          />
        )}

        {erro && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{erro}</p>}

        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Ações propostas — confirme para executar
            </p>
            <p className="text-xs text-muted-foreground">
              Você pode editar a resposta antes de enviar. O que você reescrever ensina o
              copiloto a escrever como a Morabilidade escreve.
            </p>
            {items.map((item, idx) =>
              item.status.kind === "dismissed" ? null : (
                <ProposalCard
                  key={item.id}
                  proposta={item}
                  status={item.status}
                  isExecuting={executingIdx === idx}
                  onConfirm={(textoFinal) => confirmar(idx, textoFinal)}
                  onDismiss={() => dispensar(idx)}
                />
              ),
            )}
          </div>
        )}

        {/* Captações do contato */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Captações deste contato
          </p>
          {captacoesContato.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma captação ligada ao telefone {contactPhone}.
            </p>
          ) : (
            captacoesContato.map((c) => (
              <CaptacaoCard key={c.id} captacao={c} href={linkDaCaptacao(captacoesUrl, c.id)} />
            ))
          )}
        </div>

        {/* Recentes do board */}
        {captacoesRecentes.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground">
              Recentes no board ({captacoesRecentes.length})
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {captacoesRecentes.map((c) => (
                <CaptacaoCard key={c.id} captacao={c} href={linkDaCaptacao(captacoesUrl, c.id)} />
              ))}
            </div>
          </details>
        )}

        {captacoesUrl && (
          <a
            href={captacoesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Abrir board de captações
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CaptacaoCard({ captacao, href }: { captacao: CaptacaoResumo; href?: string | null }) {
  const detalhes = [
    captacao.quartos ? `${captacao.quartos}q` : null,
    captacao.banheiros ? `${captacao.banheiros}b` : null,
    captacao.tipoPortaria,
  ].filter(Boolean);
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{captacao.endereco}</p>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {captacao.statusLabel}
        </Badge>
      </div>
      {detalhes.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">{detalhes.join(" · ")}</p>
      )}
    </>
  );

  if (!href) return <div className="rounded-lg border bg-card p-2.5">{conteudo}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border bg-card p-2.5 transition-colors hover:bg-accent"
    >
      {conteudo}
    </a>
  );
}

/**
 * Rascunho da captação: junta o que se sabe da conversa e leva para o
 * formulário completo do board. Não grava nada — a captação só passa a existir
 * quando alguém confirmar lá, com os campos obrigatórios preenchidos e depois
 * da checagem de duplicadas.
 */
function NovaCaptacaoForm({
  contactName,
  contactPhone,
  captacoesUrl,
  onEncaminhada,
}: {
  contactName: string;
  contactPhone: string;
  captacoesUrl: string | null;
  onEncaminhada: () => void;
}) {
  const [endereco, setEndereco] = useState("");
  const [quartos, setQuartos] = useState("");
  const [banheiros, setBanheiros] = useState("");
  const [tipoPortaria, setTipoPortaria] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const href = linkNovaCaptacao(captacoesUrl, {
    endereco,
    quartos,
    banheiros,
    tipo_portaria: tipoPortaria,
    proprietario_nome: contactName,
    whatsapp: contactPhone,
    observacoes,
  });

  function completarNoBoard() {
    if (!href) return;
    abrirNoBoard(href);
    onEncaminhada();
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        {contactName} entra como proprietário, com o WhatsApp {contactPhone}. Isto é um rascunho:
        ao continuar, o formulário completo do board abre já preenchido, e a captação só é criada
        quando você confirmar lá.
      </p>
      {!captacoesUrl && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          Board de captações não configurado (<code>CAPTACOES_BOARD_URL</code>) — sem ele não há
          para onde levar o rascunho.
        </p>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="cap-endereco" className="text-xs">
          Endereço *
        </Label>
        <Input
          id="cap-endereco"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Rua, número, bairro"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cap-quartos" className="text-xs">
            Quartos
          </Label>
          <Input
            id="cap-quartos"
            type="number"
            min={0}
            value={quartos}
            onChange={(e) => setQuartos(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cap-banheiros" className="text-xs">
            Banheiros
          </Label>
          <Input
            id="cap-banheiros"
            type="number"
            min={0}
            value={banheiros}
            onChange={(e) => setBanheiros(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cap-portaria" className="text-xs">
          Portaria
        </Label>
        <Input
          id="cap-portaria"
          value={tipoPortaria}
          onChange={(e) => setTipoPortaria(e.target.value)}
          placeholder="24h, eletrônica…"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cap-obs" className="text-xs">
          Observações
        </Label>
        <Textarea
          id="cap-obs"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        onClick={completarNoBoard}
        disabled={!endereco.trim() || !href}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Completar no board
      </Button>
    </div>
  );
}
