"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  Check,
  ExternalLink,
  Home,
  MessageCircle,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  criarCaptacaoDaConversaAction,
  dispensarPropostaAction,
  executarAcaoDaConversaAction,
  type AnaliseResultado,
} from "@/app/conversas/copilot-actions";
import type { ToolName } from "@/services/assistant/tools";
import type { CaptacaoResumo } from "@/services/captacoes.service";
import type { AgentProposal } from "@/types/agent-proposal";

type ItemStatus =
  | { kind: "pending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string }
  | { kind: "dismissed" };

/** O `status` do servidor é sempre "pendente" aqui (só pendentes chegam à tela),
 * então trocamos por um estado de UI mais rico — que também cobre "executando"
 * e "deu erro", situações que não existem no banco. */
interface Item extends Omit<AgentProposal, "status"> {
  status: ItemStatus;
  /** Texto editável da resposta sugerida (só em sugerir_resposta). */
  textoEditado?: string;
}

function paraItens(propostas: AgentProposal[]): Item[] {
  return propostas.map((p) => ({ ...p, status: { kind: "pending" } }));
}

const TOOL_ICON: Record<ToolName, typeof CalendarClock> = {
  agendar_visita: CalendarClock,
  criar_captacao: Home,
  sugerir_resposta: MessageCircle,
};

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
  const [criadas, setCriadas] = useState<CaptacaoResumo[]>([]);

  function analisar() {
    setErro(null);
    startAnalyzing(async () => {
      const res: AnaliseResultado = await analisarConversaAction(contactId);
      setItems(paraItens(res.propostas));
      if (!res.ok || res.propostas.length === 0) setErro(res.erro ?? "Nenhuma ação sugerida.");
    });
  }

  function confirmar(idx: number) {
    const item = items[idx];
    const args =
      item.tool === "sugerir_resposta" && item.textoEditado !== undefined
        ? { ...item.args, texto: item.textoEditado }
        : item.args;
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

  const todasDoContato = [...criadas, ...captacoesContato];

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
            onCreated={(c) => {
              setCriadas((prev) => [c, ...prev]);
              setShowForm(false);
            }}
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
            {items.map((item, idx) => {
              if (item.status.kind === "dismissed") return null;
              const Icon = TOOL_ICON[item.tool] ?? Sparkles;
              const isResposta = item.tool === "sugerir_resposta";
              return (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="min-w-0 flex-1 text-sm">{item.resumo}</p>
                    {(item.status.kind === "pending" || item.status.kind === "error") && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => dispensar(idx)}
                        aria-label="Dispensar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {isResposta && item.status.kind !== "done" && (
                    <Textarea
                      value={item.textoEditado ?? String(item.args.texto ?? "")}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, textoEditado: e.target.value } : it)),
                        )
                      }
                      rows={4}
                      className="text-sm"
                      aria-label="Texto da resposta sugerida"
                    />
                  )}
                  {!isResposta && item.status.kind !== "done" && (
                    <DetalhesArgs args={item.args} />
                  )}

                  {item.status.kind === "done" && (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {item.status.message}
                    </p>
                  )}
                  {item.status.kind === "error" && (
                    <p className="text-xs font-medium text-destructive">{item.status.message}</p>
                  )}
                  {(item.status.kind === "pending" || item.status.kind === "error") && (
                    <Button size="sm" onClick={() => confirmar(idx)} loading={executingIdx === idx}>
                      <Check className="h-3.5 w-3.5" />
                      {isResposta ? "Enviar resposta" : "Confirmar"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Captações do contato */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Captações deste contato
          </p>
          {todasDoContato.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma captação ligada ao telefone {contactPhone}.
            </p>
          ) : (
            todasDoContato.map((c) => <CaptacaoCard key={c.id} captacao={c} />)
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
                <CaptacaoCard key={c.id} captacao={c} />
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

function CaptacaoCard({ captacao }: { captacao: CaptacaoResumo }) {
  const detalhes = [
    captacao.quartos ? `${captacao.quartos}q` : null,
    captacao.banheiros ? `${captacao.banheiros}b` : null,
    captacao.tipoPortaria,
  ].filter(Boolean);
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{captacao.endereco}</p>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {captacao.statusLabel}
        </Badge>
      </div>
      {detalhes.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">{detalhes.join(" · ")}</p>
      )}
    </div>
  );
}

/** Campos propostos pela IA (fora a resposta), visíveis antes do confirmar —
 * o operador precisa ver o que vai ser gravado, não só um resumo. */
function DetalhesArgs({ args }: { args: Record<string, unknown> }) {
  const entradas = Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entradas.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
      {entradas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
          <dd className="break-words">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function NovaCaptacaoForm({
  contactName,
  contactPhone,
  onCreated,
}: {
  contactName: string;
  contactPhone: string;
  onCreated: (c: CaptacaoResumo) => void;
}) {
  const [endereco, setEndereco] = useState("");
  const [quartos, setQuartos] = useState("");
  const [banheiros, setBanheiros] = useState("");
  const [tipoPortaria, setTipoPortaria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, startSaving] = useTransition();

  function salvar() {
    startSaving(async () => {
      const res = await criarCaptacaoDaConversaAction({
        endereco,
        quartos: quartos ? Number(quartos) : null,
        banheiros: banheiros ? Number(banheiros) : null,
        tipoPortaria: tipoPortaria || undefined,
        contatoProprietario: `${contactName} ${contactPhone}`,
        observacoes: observacoes || undefined,
      });
      if (res.ok && res.captacao) {
        toast.success(res.message);
        onCreated(res.captacao);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        O proprietário ({contactName}) entra automaticamente como contato da captação.
      </p>
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
      <Button size="sm" onClick={salvar} loading={isSaving} disabled={!endereco.trim()}>
        <Plus className="h-3.5 w-3.5" />
        Criar captação
      </Button>
    </div>
  );
}
