import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Link2, UserPlus } from "lucide-react";
import { whatsappLink, formatarTelefone, formatBRL, diasParado, resumoSpecs } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditCaptacao } from "@/components/captacao/EditCaptacao";
import { DecisaoBox } from "@/components/captacao/DecisaoBox";
import { DecisaoBar } from "@/components/captacao/DecisaoBar";
import { CadastrarImovel } from "@/components/captacao/CadastrarImovel";
import { PublicarCaptacao } from "@/components/captacao/PublicarCaptacao";
import { AgendamentoCard } from "@/components/captacao/AgendamentoCard";
import { Galeria } from "@/components/captacao/Galeria";
import { Documentos } from "@/components/captacao/Documentos";
import { ExcluirCaptacao } from "@/components/captacao/ExcluirCaptacao";
import { CompartilharCaptacao } from "@/components/captacao/CompartilharCaptacao";
import { Historico } from "@/components/captacao/Historico";
import { ListasDaCaptacao } from "@/components/captacao/ListasDaCaptacao";
import { Opinioes } from "@/components/captacao/Opinioes";
import { createClient } from "@/lib/supabase/server";
import { STATUS_STYLE } from "@/lib/status-style";
import { etapaDaCaptacao } from "@/lib/etapa";
import { PARAM_NOVA } from "@/lib/captacao-link";
import { BOTAO_SECUNDARIO, cn } from "@/lib/utils";
import type { Captacao, Documento, Midia, Opiniao, Perfil } from "@/types";

export const dynamic = "force-dynamic";

/**
 * O detalhe é um formulário longo, não um painel: no desktop ele para de
 * esticar antes das abas (1180px) — linha de texto e campo largos demais
 * cansam mais do que ajudam.
 */
const TRILHO = "mx-auto w-full max-w-[900px]";

/**
 * Olive chapado, não o degradê das abas: a barra de cima é sticky e precisa de
 * fundo opaco próprio — com degradê, a emenda entre ela e o herói apareceria
 * assim que a página rolasse.
 */
const OLIVE = "#45443c";

/**
 * O cabeçalho não usa branco transparente: sobre o olive ele sai acinzentado e
 * frio. Os tons abaixo são quentes de propósito — é a mesma família do
 * dourado da marca, puxada para baixo até dar contraste no fundo escuro.
 */
const HEADER = {
  /** "CAPTAÇÃO · DECIDIR" e o rodapé de specs. */
  caption: "#a9a184",
  ficha: "#a8a595",
  /** Endereço e complemento: o número do apartamento vem em dourado. */
  titulo: "#f5f3ec",
  complemento: "#b8a56b",
} as const;

/**
 * Título de seção: serifa com o fio dourado por baixo, do tamanho da palavra.
 * É o que separa um bloco do outro num formulário longo sem precisar de mais
 * uma borda.
 */
const TITULO_SECAO =
  "inline-block border-b-2 border-primary pb-2 font-serif text-lg leading-snug text-[#2e302a]";

const VOLTAR_HREF: Record<string, string> = {
  decidir: "/decidir",
  aprovada: "/aprovadas",
  negativada: "/negativadas",
  publicada: "/aprovadas",
};

const VOLTAR_LABEL: Record<string, string> = {
  decidir: "Decidir",
  aprovada: "Aprovadas",
  negativada: "Negativadas",
  publicada: "Aprovadas",
};

export default async function CaptacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: captacao } = await supabase.from("captacao").select("*").eq("id", id).single();
  if (!captacao) notFound();

  const [{ data: midias }, { data: docs }, { data: eventos }, { data: opinioes }, { data: perfis }, { data: auth }] =
    await Promise.all([
      supabase.from("midia").select("*").eq("captacao_id", id).order("ordem"),
      supabase.from("documento").select("*").eq("captacao_id", id).order("criado_em"),
      supabase.from("historico").select("*").eq("captacao_id", id).order("criado_em", { ascending: false }),
      supabase.from("opiniao").select("*").eq("captacao_id", id).order("criado_em"),
      supabase.from("perfil").select("*"),
      supabase.auth.getUser(),
    ]);

  const c = captacao as Captacao;
  const nomes = Object.fromEntries(((perfis ?? []) as Perfil[]).map((p) => [p.user_id, p.nome]));
  const ramoAgendamento = etapaDaCaptacao(c) === "aprovada";
  const st = STATUS_STYLE[c.status];
  // Voltar leva para a aba de onde a captação veio, não para um quadro genérico.
  const etapa = etapaDaCaptacao(c);
  const voltarPara = VOLTAR_HREF[etapa];
  const parada = diasParado(c.atualizado_em);
  const resumo = resumoSpecs(c);
  const zap = c.whatsapp ? whatsappLink(c.whatsapp) : null;
  // Outro imóvel do mesmo proprietário: abre o formulário de captação nova já
  // com o contato preenchido, pelo mesmo link que o copiloto do WhatsApp usa.
  const outraDoNumero = c.whatsapp
    ? `/decidir?${new URLSearchParams({
        [PARAM_NOVA]: "1",
        whatsapp: c.whatsapp,
        ...(c.proprietario_nome ? { proprietario_nome: c.proprietario_nome } : {}),
      })}`
    : null;

  return (
    <main className="min-h-dvh bg-[#f3f4f0] pb-28 lg:pb-12">
      {/* Barra de cima: fica grudada no topo porque o detalhe é um formulário
          longo — a pessoa precisa saber de qual captação é o campo que está
          preenchendo, e ter a saída à mão, sem rolar de volta. */}
      <div className="sticky top-0 z-20 text-white" style={{ background: OLIVE }}>
        <div className={cn(TRILHO, "flex items-center gap-3 px-4 py-2.5")}>
          <Link
            href={voltarPara}
            aria-label={`Voltar para ${VOLTAR_LABEL[etapa]}`}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-black/25 text-white/90 transition-colors hover:bg-black/40"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: HEADER.caption }}
            >
              Captação · {VOLTAR_LABEL[etapa]}
            </p>
            <p className="truncate text-[15px] font-semibold" style={{ color: HEADER.titulo }}>
              {c.endereco}
              {c.apto && ` · ap ${c.apto}`}
            </p>
          </div>

          <ExcluirCaptacao id={c.id} />
        </div>
      </div>

      {/* Herói */}
      <div className="text-white" style={{ background: OLIVE }}>
        <div className={cn(TRILHO, "px-4 pb-5 pt-1.5")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-[25px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.10] px-2.5 text-[11.5px] font-semibold text-[#d9cf9e]">
              <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: st.dot }} />
              {st.short}
            </span>

            <ListasDaCaptacao captacaoId={c.id} tom="escuro" />

            {parada >= 3 && (
              <span className="ml-auto flex-none text-[12px] font-medium text-[#b9a96e]">
                parada há {parada} dias
              </span>
            )}
          </div>

          <h1
            className="mt-3.5 font-serif text-[26px] font-semibold leading-[1.18] tracking-[-0.01em]"
            style={{ color: HEADER.titulo }}
          >
            {c.endereco}
            {c.apto && <span style={{ color: HEADER.complemento }}> · ap {c.apto}</span>}
          </h1>

          {/* Bairro e ficha na mesma linha: é o cabeçalho de uma captação, não
              a busca — quem abriu já sabe o endereço e quer o resto. */}
          {(c.bairro || resumo) && (
            <p className="mt-1.5 text-[13px]" style={{ color: HEADER.ficha }}>
              {[c.bairro, resumo].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Contato: a primeira coisa depois do endereço porque quase toda
          decisão passa por falar com o proprietário. */}
      {(c.proprietario_nome || c.whatsapp || c.share_token || c.anuncio_url || outraDoNumero) && (
        <div className={cn(TRILHO, "px-4 pt-[18px]")}>
          <div className="rounded-[18px] border border-[#e8e9e3] bg-white p-4 shadow-[0_1px_2px_rgba(46,48,42,0.04)]">
            {(c.proprietario_nome || c.whatsapp) && (
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 flex-none text-[#7a7d70]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#2e302a]">
                    {c.proprietario_nome ?? "Contato"}
                  </p>
                  {c.whatsapp && (
                    <p className="text-[12.5px] font-medium text-[#2f6b46]">
                      {formatarTelefone(c.whatsapp)}
                    </p>
                  )}
                </div>
                {zap && (
                  <a
                    href={zap}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 flex-none items-center rounded-xl bg-[#2f6b46] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#285c3c]"
                  >
                    Chamar
                  </a>
                )}
              </div>
            )}

            {(c.share_token || c.anuncio_url) && (
              <div
                className={cn(
                  "grid grid-cols-2 gap-2.5",
                  (c.proprietario_nome || c.whatsapp) && "mt-3.5"
                )}
              >
                {c.share_token && (
                  <CompartilharCaptacao token={c.share_token} endereco={c.endereco} />
                )}
                {c.anuncio_url && (
                  <a
                    href={c.anuncio_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(BOTAO_SECUNDARIO, !c.share_token && "col-span-2")}
                  >
                    <Link2 className="h-4 w-4 flex-none" /> Anúncio
                  </a>
                )}
              </div>
            )}

            {/* Tracejado de propósito: não é uma ação sobre ESTA captação, é
                um atalho para começar outra com o mesmo contato. */}
            {outraDoNumero && (
              <Link
                href={outraDoNumero}
                className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d2d4cb] text-[13.5px] font-medium text-[#7a7d70] transition-colors hover:bg-[#f5f6f1]"
              >
                <UserPlus className="h-4 w-4" /> Outra captação deste número
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={cn(TRILHO, "space-y-[14px] px-4 py-[18px] lg:py-6")}>

      {(c.valor_venda != null || c.valor_aluguel != null || c.valor_condominio != null || c.valor_iptu != null) && (
        // Mesma caixa e mesmo rótulo miúdo da composição, um degrau acima no
        // tamanho: venda e aluguel são o que se compara entre captações.
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { rotulo: "Venda", valor: c.valor_venda, forte: true },
            { rotulo: "Aluguel", valor: c.valor_aluguel, forte: true },
            { rotulo: "Condomínio", valor: c.valor_condominio, forte: false },
            { rotulo: "IPTU", valor: c.valor_iptu, forte: false },
          ].map((v) => (
            <div key={v.rotulo} className="rounded-[14px] border border-[#e8e9e3] bg-white p-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#8b8e82]">
                {v.rotulo}
              </p>
              <p
                className={cn(
                  "mt-1 text-[15px] font-bold tracking-[-0.01em]",
                  v.forte ? "text-[#2e302a]" : "text-[#6e7063]"
                )}
              >
                {formatBRL(v.valor)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className={TITULO_SECAO}>Dados da captação</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCaptacao captacao={c} />
        </CardContent>
      </Card>

      {(c.status === "em_decisao" || c.decisao) && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className={TITULO_SECAO}>Decisão</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisaoBox
              captacao={c}
              autorNome={c.decisao_autor ? nomes[c.decisao_autor] ?? null : null}
              perfis={(perfis ?? []) as Perfil[]}
              userId={auth.user?.id ?? ""}
            />
          </CardContent>
        </Card>
      )}

      {c.decisao === "aprovada" && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className={TITULO_SECAO}>Cadastro no sistema</CardTitle>
          </CardHeader>
          <CardContent>
            {c.imovel_codigo ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="positive">Imóvel {c.imovel_codigo}</Badge>
                <span className="text-muted-foreground">já cadastrado no back-office.</span>
                {process.env.NEXT_PUBLIC_PAINEL_URL && c.imovel_id && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_PAINEL_URL}/imoveis/${c.imovel_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Abrir no painel
                  </a>
                )}
              </div>
            ) : (
              <CadastrarImovel captacao={c} />
            )}
          </CardContent>
        </Card>
      )}

      {ramoAgendamento && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className={TITULO_SECAO}>Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <AgendamentoCard captacao={c} />
          </CardContent>
        </Card>
      )}

      {(c.decisao === "aprovada" || c.status === "publicada") && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className={TITULO_SECAO}>Publicação</CardTitle>
          </CardHeader>
          <CardContent>
            <PublicarCaptacao captacao={c} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className={TITULO_SECAO}>Fotos e vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          <Galeria captacaoId={c.id} midiasIniciais={(midias ?? []) as Midia[]} capaInicial={c.capa_path} />
        </CardContent>
      </Card>

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className={TITULO_SECAO}>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Documentos captacaoId={c.id} docsIniciais={(docs ?? []) as Documento[]} />
        </CardContent>
      </Card>

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className={TITULO_SECAO}>Opiniões da equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Opinioes
            captacaoId={c.id}
            userId={auth.user?.id ?? ""}
            opinioesIniciais={(opinioes ?? []) as Opiniao[]}
            perfis={(perfis ?? []) as Perfil[]}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className={TITULO_SECAO}>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Historico eventos={(eventos ?? []) as never} nomes={nomes} />
        </CardContent>
      </Card>
      </div>

      <DecisaoBar captacao={c} perfis={(perfis ?? []) as Perfil[]} userId={auth.user?.id ?? ""} />
    </main>
  );
}
