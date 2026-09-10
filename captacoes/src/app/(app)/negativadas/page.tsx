"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Archive, Check, ChevronRight, Clock, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { VazioRetornos } from "@/components/app/Vazios";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/stores/app";
import { createClient } from "@/lib/supabase/client";
import { contadores, hojeLocal } from "@/lib/contadores";
import { historicoNegativadas, retornosPendentes, situacaoRetorno } from "@/lib/retorno";
import { dataCurta, whatsappLink } from "@/lib/format";
import { cn, CONTAINER, HOVER_CARD } from "@/lib/utils";
import type { Captacao } from "@/types";

export default function NegativadasPage() {
  const { cards, userId } = useApp();
  // "Suas" ligado por padrão: você abre a aba e vê primeiro o que é seu.
  const [somenteSuas, setSomenteSuas] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const hoje = hojeLocal();
  const nums = useMemo(() => contadores(cards, hoje, userId), [cards, hoje, userId]);

  const suas = useMemo(() => retornosPendentes(cards, hoje, userId), [cards, hoje, userId]);
  const todas = useMemo(() => retornosPendentes(cards, hoje), [cards, hoje]);
  const fila = somenteSuas ? suas : todas;

  const historico = useMemo(() => historicoNegativadas(cards), [cards]);

  return (
    <>
      <AppHeader
        titulo="Negativadas"
        contadores={nums}
        busca={false}
        subtitulo={
          todas.length === 0 ? (
            "Nenhum retorno pendente"
          ) : (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-[7px] w-[7px] rounded-full",
                  nums.atrasados > 0 ? "bg-[#e08b8b]" : "bg-white/50"
                )}
              />
              {todas.length} {todas.length === 1 ? "retorno pendente" : "retornos pendentes"}
              {nums.atrasados > 0 && ` · ${nums.atrasados} atrasado${nums.atrasados > 1 ? "s" : ""}`}
            </span>
          )
        }
      />

      <div className="flex-none border-b bg-background">
        <div className={cn(CONTAINER, "px-[18px] py-3 lg:px-6")}>
          {/* Alternador Suas/Todas: no desktop não precisa ocupar a largura toda. */}
          <div className="flex rounded-xl bg-muted p-[3px] lg:max-w-xs">
            <button
              type="button"
              onClick={() => setSomenteSuas(true)}
              aria-pressed={somenteSuas}
              className={cn(
                "h-[34px] flex-1 rounded-[9px] text-[13px] font-semibold",
                somenteSuas ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Suas <span className="opacity-55">{suas.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setSomenteSuas(false)}
              aria-pressed={!somenteSuas}
              className={cn(
                "h-[34px] flex-1 rounded-[9px] text-[13px] font-semibold",
                !somenteSuas ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Todas <span className="opacity-55">{todas.length}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={cn(CONTAINER, "no-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] pb-6 pt-4 [&>*]:shrink-0 lg:px-6 lg:pb-8")}>
        {fila.length === 0 ? (
          <VazioRetornos suas={somenteSuas} />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Retornos pendentes
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className={GRADE}>
              {fila.map((c) => (
                <CardRetorno key={c.id} captacao={c} hoje={hoje} />
              ))}
            </div>
          </>
        )}

        {historico.length > 0 && (
          <section className="mt-2">
            <button
              type="button"
              onClick={() => setHistoricoAberto((v) => !v)}
              aria-expanded={historicoAberto}
              className="flex w-full items-center gap-3 rounded-2xl border bg-muted px-3.5 py-3.5 text-left"
            >
              <span className="h-2 w-2 flex-none rounded-full bg-[#a85a5a]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-foreground">
                  Histórico de negativadas
                </span>
                <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                  {historico.length} no total · retorno já dado
                </span>
              </span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 flex-none text-muted-foreground transition-transform",
                  historicoAberto && "rotate-90"
                )}
              />
            </button>

            {historicoAberto && (
              <div className={cn(GRADE, "mt-2.5")}>
                {historico.map((c) => (
                  <CardHistorico key={c.id} captacao={c} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

/** Mesma grade das outras abas: uma coluna no celular, duas no desktop. */
const GRADE = "flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3";

const FAIXA = {
  atrasado: { bg: "#f7ecec", bd: "#f0dcdc", fg: "#8a4444", Icone: AlertCircle },
  hoje: { bg: "#f7f3e8", bd: "#eee6d2", fg: "#857727", Icone: Clock },
} as const;

/** Cartão da fila: o motivo é conteúdo de primeira linha — é o que se diz ao ligar. */
function CardRetorno({ captacao, hoje }: { captacao: Captacao; hoje: string }) {
  const { patch, perfis, beginSave, endSave, userId } = useApp();
  const [salvando, setSalvando] = useState(false);
  const situacao = situacaoRetorno(captacao, hoje);
  const faixa = situacao === "atrasado" ? FAIXA.atrasado : situacao === "hoje" ? FAIXA.hoje : null;
  const responsavel = perfis.find((p) => p.user_id === captacao.retorno_responsavel);
  const zap = whatsappLink(captacao.whatsapp);

  async function marcarFeito() {
    setSalvando(true);
    beginSave();
    const dados = {
      retorno_feito: true,
      retorno_feito_em: new Date().toISOString(),
      retorno_feito_por: userId,
    };
    const supabase = createClient();
    const { error } = await supabase.from("captacao").update(dados).eq("id", captacao.id);
    setSalvando(false);
    endSave(!error);
    if (error) return toast.error("Não foi possível marcar o retorno.");
    patch(captacao.id, dados);
    toast.success("Retorno registrado. Saiu da fila.");
  }

  return (
    <article
      className={cn(
        // `shrink-0` não é decorativo: o `overflow-hidden` daqui zera a altura
        // mínima automática do cartão, e num container flex-column sem espaço
        // sobrando ele era ESPREMIDO em vez de rolar — cortava o rodapé do
        // cartão e escondia justamente o botão "Retorno dado".
        "shrink-0 overflow-hidden rounded-[17px] border bg-card shadow-[0_1px_2px_rgba(46,48,42,0.04),0_10px_24px_-18px_rgba(46,48,42,0.22)]",
        HOVER_CARD,
        situacao === "atrasado" && "border-[#e6c5c5]"
      )}
    >
      {faixa && (
        <div
          className="flex items-center gap-2 border-b px-[15px] py-2.5"
          style={{ background: faixa.bg, borderColor: faixa.bd }}
        >
          <faixa.Icone className="h-3.5 w-3.5" style={{ color: faixa.fg }} strokeWidth={2.2} />
          <span className="text-xs font-bold" style={{ color: faixa.fg }}>
            {situacao === "atrasado"
              ? `Atrasado · venceu em ${dataCurta(captacao.retorno_prazo)}`
              : `Para hoje · ${dataCurta(captacao.retorno_prazo)}`}
          </span>
        </div>
      )}

      <div className="p-[15px]">
        <Link href={`/captacao/${captacao.id}`}>
          <h3 className="text-base font-semibold leading-tight text-foreground">{captacao.endereco}</h3>
          {captacao.bairro && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
              <MapPin className="h-3 w-3 text-[#9a8d3a]" />
              {captacao.bairro}
            </p>
          )}
        </Link>

        {captacao.proprietario_nome && (
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar nome={captacao.proprietario_nome} size={28} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">{captacao.proprietario_nome}</p>
              <p className="text-[11.5px] text-muted-foreground">proprietário</p>
            </div>
          </div>
        )}

        {captacao.decisao_motivo ? (
          <div className="mt-3 rounded-xl border bg-muted/40 p-3">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Motivo da reprovação
            </p>
            <p className="text-[13px] leading-relaxed text-foreground/85">{captacao.decisao_motivo}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed bg-muted/30 p-3 text-[12.5px] text-muted-foreground">
            Sem motivo registrado — esta captação foi reprovada antes da v2.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
          {responsavel && <span>Com {responsavel.nome.split(" ")[0]}</span>}
          {situacao === "sem_prazo" && <span>· sem prazo</span>}
          {situacao === "futuro" && <span>· até {dataCurta(captacao.retorno_prazo)}</span>}
        </div>

        <div className="mt-3.5 flex gap-2.5">
          {zap && (
            <a
              href={zap}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-none items-center justify-center gap-1.5 rounded-xl border border-[#d8e7df] bg-[#eef4f0] px-3.5 py-3 text-[13.5px] font-semibold text-[#2f6b46]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={marcarFeito}
            disabled={salvando}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground py-3 text-[13.5px] font-semibold text-background disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={2.4} />
            Retorno dado
          </button>
        </div>
      </div>
    </article>
  );
}

function CardHistorico({ captacao }: { captacao: Captacao }) {
  const perfis = useApp((s) => s.perfis);
  const nome = (id: string | null) => (id ? perfis.find((p) => p.user_id === id)?.nome ?? "—" : "—");

  return (
    <Link
      href={`/captacao/${captacao.id}`}
      className="block rounded-2xl border bg-card p-3.5 shadow-[0_1px_2px_rgba(46,48,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">{captacao.endereco}</h3>
          {captacao.bairro && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">{captacao.bairro}</p>
          )}
        </div>
        <span className="inline-flex h-[23px] flex-none items-center gap-1.5 rounded-md bg-[#f0e2e2] px-2.5 text-[11.5px] font-semibold text-[#7a3434]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a85a5a]" />
          {dataCurta(captacao.decisao_em)}
        </span>
      </div>

      {captacao.decisao_motivo && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-foreground/80">{captacao.decisao_motivo}</p>
      )}

      {captacao.arquivado_em && (
        <span className="mt-2.5 inline-flex h-[23px] items-center gap-1.5 rounded-md bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          <Archive className="h-3 w-3" />
          Fotos arquivadas
        </span>
      )}

      <div className="mt-3 flex items-center gap-3.5 border-t pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Reprovada por
          </p>
          <p className="mt-0.5 truncate text-[12.5px] font-semibold text-foreground">
            {nome(captacao.decisao_autor)}
          </p>
        </div>
        <span className="h-6 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Retorno dado
          </p>
          <p className="mt-0.5 truncate text-[12.5px] font-semibold text-foreground">
            {captacao.retorno_feito_por
              ? `${nome(captacao.retorno_feito_por).split(" ")[0]} · ${dataCurta(captacao.retorno_feito_em)}`
              : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
