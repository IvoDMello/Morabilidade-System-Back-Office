"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  UserSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { StatusBadge } from "@/features/contacts/components/status-badge";
import { PreferenciaForm } from "./preferencia-form";
import { enviarImoveisAction } from "@/app/oportunidades/actions";
import { montarRascunho, formatarMoeda, resumoDoImovel } from "../lib/mensagem";
import { descreverPreferencia } from "../lib/resumo-preferencia";
import { cn, formatPhone } from "@/lib/utils";
import type { ImovelCompativel, OportunidadeDoContato } from "@/types/oportunidade";

interface OportunidadeCardProps {
  item: OportunidadeDoContato;
  siteUrl: string | null;
  /** Abre já expandido — usado pelo deep-link `?c=<contactId>`. */
  aberturaInicial?: boolean;
}

/** "Falta: Vagas 1+" — o que impede este imóvel de ser 100%. */
function motivoDoQuase(imovel: ImovelCompativel): string | null {
  const fora = imovel.criterios.find((c) => c.status === "fora");
  if (!fora) return null;
  return fora.pedido ? `${fora.rotulo} ${fora.pedido}` : fora.rotulo;
}

export function OportunidadeCard({ item, siteUrl, aberturaInicial }: OportunidadeCardProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(Boolean(aberturaInicial));
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [rascunhoEditado, setRascunhoEditado] = useState(false);
  const [isEnviando, startEnvio] = useTransition();

  const imoveisSelecionados = useMemo(
    () => selecionados
      .map((id) => item.imoveis.find((i) => i.id === id))
      .filter((i): i is ImovelCompativel => Boolean(i)),
    [selecionados, item.imoveis],
  );

  /** Regera o texto a partir da seleção, a menos que já tenha sido editado à mão. */
  function sincronizarRascunho(novaSelecao: string[], forcar = false) {
    if (rascunhoEditado && !forcar) return;
    const imoveis = novaSelecao
      .map((id) => item.imoveis.find((i) => i.id === id))
      .filter((i): i is ImovelCompativel => Boolean(i));
    setRascunho(montarRascunho({ nomeContato: item.nome, imoveis, siteUrl }));
    if (forcar) setRascunhoEditado(false);
  }

  function alternarImovel(id: string) {
    // A próxima seleção é calculada fora do updater de propósito: um `setState`
    // dentro de outro roda duas vezes em StrictMode e é efeito colateral em
    // função que deveria ser pura.
    const proxima = selecionados.includes(id)
      ? selecionados.filter((x) => x !== id)
      : [...selecionados, id];
    setSelecionados(proxima);
    sincronizarRascunho(proxima);
  }

  function enviar() {
    startEnvio(async () => {
      const resultado = await enviarImoveisAction(
        item.contactId,
        rascunho,
        imoveisSelecionados.map((i) => ({ codigo: i.codigo, titulo: i.titulo })),
      );
      if (!resultado.ok) {
        toast.error(resultado.erro ?? "Não foi possível enviar.");
        return;
      }
      toast.success(
        imoveisSelecionados.length === 1
          ? "Imóvel enviado e registrado na conversa."
          : `${imoveisSelecionados.length} imóveis enviados e registrados na conversa.`,
      );
      setSelecionados([]);
      setRascunho("");
      setRascunhoEditado(false);
      router.refresh();
    });
  }

  const temPerfil = Boolean(item.preferencia);
  const quases = item.imoveis.length - item.compativeis;

  return (
    <li className="rounded-xl border border-veil/7 bg-raised transition-colors hover:border-veil/14">
      {/* Cabeçalho — clicável inteiro para abrir/fechar */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-start gap-2.5 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <AvatarInitials name={item.nome} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold">{item.nome}</span>
            <StatusBadge status={item.status} />
            {item.compativeis > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11.5px] font-semibold text-gold">
                <Sparkles className="h-3 w-3" />
                {item.compativeis} para enviar
              </span>
            )}
            {item.compativeis === 0 && quases > 0 && (
              <span className="rounded-lg border border-veil/12 px-2 py-0.5 text-[11.5px] text-ink-mid">
                {quases} quase
              </span>
            )}
            {!temPerfil && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-veil/12 px-2 py-0.5 text-[11.5px] text-ink-dim">
                <UserSearch className="h-3 w-3" />
                sem perfil de busca
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
            <span>{formatPhone(item.telefone)}</span>
            <CategoryBadge category={item.categoria} />
          </p>
          {temPerfil && (
            <p className="mt-1 truncate text-xs text-ink-mid">
              Procura: {descreverPreferencia(item.preferencia!)}
            </p>
          )}
        </div>
        <span className="mt-1 shrink-0 text-ink-dim">
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {aberto && (
        <div className="flex flex-col gap-3 border-t border-veil/7 p-3">
          {/* Perfil de busca */}
          {editandoPerfil ? (
            <PreferenciaForm
              contactId={item.contactId}
              preferencia={item.preferencia}
              onSalvo={() => {
                setEditandoPerfil(false);
                router.refresh();
              }}
              onCancelar={() => setEditandoPerfil(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-well/40 px-3 py-2">
              <p className="min-w-0 text-xs text-ink-mid">
                {temPerfil ? (
                  <>
                    {descreverPreferencia(item.preferencia!)}
                    {item.preferencia!.observacoes && (
                      <span className="text-ink-dim"> · {item.preferencia!.observacoes}</span>
                    )}
                  </>
                ) : (
                  "Ninguém registrou o que este contato procura — sem isso não há o que cruzar com o catálogo."
                )}
              </p>
              <Button
                type="button"
                variant={temPerfil ? "ghost" : "default"}
                size="sm"
                onClick={() => setEditandoPerfil(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {temPerfil ? "Editar perfil" : "Preencher perfil"}
              </Button>
            </div>
          )}

          {/* Imóveis */}
          {temPerfil && item.imoveis.length === 0 && (
            <p className="rounded-lg border border-dashed border-veil/12 px-3 py-4 text-center text-xs text-ink-dim">
              Nenhum imóvel disponível bate com esse perfil hoje. Afrouxe um critério (bairro
              ou faixa de valor) para ver o que chega perto.
            </p>
          )}

          {item.imoveis.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {item.imoveis.map((imovel) => {
                const marcado = selecionados.includes(imovel.id);
                const falta = imovel.compativel ? null : motivoDoQuase(imovel);
                return (
                  <li key={imovel.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                        marcado
                          ? "border-primary/35 bg-primary/8"
                          : "border-veil/7 hover:border-veil/14",
                      )}
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={() => alternarImovel(imovel.id)}
                        className="mt-0.5"
                        aria-label={`Incluir ${imovel.codigo} na mensagem`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[12.5px] font-semibold">
                            {imovel.codigo}
                          </span>
                          <span className="truncate text-[12.5px] text-ink-mid">
                            {imovel.titulo ?? resumoDoImovel(imovel)}
                          </span>
                          {imovel.compativel ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-jade/12 px-1.5 py-0.5 text-[11px] font-semibold text-jade">
                              <Check className="h-3 w-3" />
                              bate tudo
                            </span>
                          ) : (
                            falta && (
                              <span className="rounded bg-gold/12 px-1.5 py-0.5 text-[11px] font-semibold text-gold">
                                falta {falta}
                              </span>
                            )
                          )}
                          {imovel.jaEnviado && (
                            <span className="rounded border border-veil/12 px-1.5 py-0.5 text-[11px] text-ink-dim">
                              já enviado
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-dim">
                          <Building2 className="h-3 w-3" />
                          <span>
                            {imovel.bairro}, {imovel.cidade}
                          </span>
                          {resumoDoImovel(imovel) && <span>· {resumoDoImovel(imovel)}</span>}
                          {imovel.valor !== null && (
                            <span className="font-medium text-ink-mid">
                              · {formatarMoeda(imovel.valor)}
                              {imovel.tipoNegocio === "locacao" ? "/mês" : ""}
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Rascunho + envio */}
          {selecionados.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-veil/8 bg-well/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-mid">
                  Mensagem ({selecionados.length}{" "}
                  {selecionados.length === 1 ? "imóvel" : "imóveis"})
                </span>
                {rascunhoEditado && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => sincronizarRascunho(selecionados, true)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Refazer texto
                  </Button>
                )}
              </div>

              <Textarea
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value);
                  setRascunhoEditado(true);
                }}
                rows={8}
                aria-label={`Mensagem para ${item.nome}`}
              />

              {!item.janela.aberta && (
                <p className="flex items-start gap-1.5 rounded-lg bg-ember/10 px-2 py-1.5 text-[11.5px] text-ember">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    A janela de 24h está fechada
                    {item.janela.fechaEm
                      ? " (o cliente não escreve há mais de um dia)"
                      : " (este contato nunca escreveu)"}
                    . A Meta só aceita template fora dela — o envio livre provavelmente será
                    recusado.
                  </span>
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/?c=${item.contactId}`}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-dim transition-colors hover:text-ink-mid"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Abrir conversa
                </Link>
                <Button type="button" onClick={enviar} disabled={isEnviando || !rascunho.trim()}>
                  {isEnviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar no WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
