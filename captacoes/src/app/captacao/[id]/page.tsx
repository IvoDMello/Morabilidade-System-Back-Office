import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Link2 } from "lucide-react";
import { whatsappLink, formatarTelefone, formatBRL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditCaptacao } from "@/components/captacao/EditCaptacao";
import { DecisaoBox } from "@/components/captacao/DecisaoBox";
import { DecisaoBar } from "@/components/captacao/DecisaoBar";
import { CadastrarImovel } from "@/components/captacao/CadastrarImovel";
import { Agendamento } from "@/components/captacao/Agendamento";
import { Galeria } from "@/components/captacao/Galeria";
import { Documentos } from "@/components/captacao/Documentos";
import { ExcluirCaptacao } from "@/components/captacao/ExcluirCaptacao";
import { Historico } from "@/components/captacao/Historico";
import { createClient } from "@/lib/supabase/server";
import { STATUS_STYLE } from "@/lib/status-style";
import type { Captacao, Documento, Midia } from "@/types";

export const dynamic = "force-dynamic";

export default async function CaptacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: captacao } = await supabase.from("captacao").select("*").eq("id", id).single();
  if (!captacao) notFound();

  const [{ data: midias }, { data: docs }, { data: eventos }] = await Promise.all([
    supabase.from("midia").select("*").eq("captacao_id", id).order("ordem"),
    supabase.from("documento").select("*").eq("captacao_id", id).order("criado_em"),
    supabase.from("historico").select("*").eq("captacao_id", id).order("criado_em", { ascending: false }),
  ]);

  const c = captacao as Captacao;
  const ramoAgendamento =
    c.status === "pendente_agendar_visita" || c.status === "pendente_agendar_gravacao";
  const st = STATUS_STYLE[c.status];

  return (
    <main className="min-h-dvh bg-[#f3f4f0] pb-28">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e6e7e1] bg-white px-4 py-2.5">
        <Link href="/board" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4a4d43]">
          <ArrowLeft className="h-4 w-4" /> Voltar ao quadro
        </Link>
        <ExcluirCaptacao id={c.id} />
      </div>

      {/* Hero */}
      <div className="bg-white px-4 pb-5 pt-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: st.bg, color: st.fg }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}
        </span>
        <h1 className="mt-3 font-serif text-[25px] font-semibold leading-[1.18] tracking-[-0.01em] text-[#2e302a]">
          {c.endereco}
        </h1>
        {(c.proprietario_nome || c.whatsapp || c.anuncio_url) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {c.whatsapp && whatsappLink(c.whatsapp) ? (
              <a
                href={whatsappLink(c.whatsapp)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8e7df] bg-[#eef4f0] px-3 py-2 text-sm font-medium text-[#2f6b46]"
              >
                <MessageCircle className="h-4 w-4" />
                <span>
                  {c.proprietario_nome ?? "Contato"} · {formatarTelefone(c.whatsapp)}
                </span>
              </a>
            ) : (
              c.proprietario_nome && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-[#e8e9e3] bg-[#f5f6f1] px-3 py-2 text-sm text-[#585a4f]">
                  {c.proprietario_nome}
                </span>
              )
            )}
            {c.anuncio_url && (
              <a
                href={c.anuncio_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#ece4b8] bg-[#faf7e8] px-3 py-2 text-sm font-medium text-[#9a8d3a]"
              >
                <Link2 className="h-4 w-4" /> Anúncio
              </a>
            )}
          </div>
        )}
      </div>

      <div className="space-y-[14px] px-4 py-[18px]">

      {(c.valor_venda != null || c.valor_condominio != null || c.valor_iptu != null) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Venda</p>
            <p className="text-base font-semibold text-primary">{formatBRL(c.valor_venda)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Condomínio</p>
            <p className="text-base font-semibold">{formatBRL(c.valor_condominio)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">IPTU</p>
            <p className="text-base font-semibold">{formatBRL(c.valor_iptu)}</p>
          </div>
        </div>
      )}

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Dados da captação</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCaptacao captacao={c} />
        </CardContent>
      </Card>

      {(c.status === "em_decisao" || c.decisao) && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Decisão</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisaoBox captacao={c} />
          </CardContent>
        </Card>
      )}

      {c.decisao === "aprovada" && (
        <Card className="rounded-[18px] border-[#e8e9e3]">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Cadastro no sistema</CardTitle>
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
            <CardTitle className="font-serif text-lg">Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Agendamento captacao={c} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Fotos e vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          <Galeria captacaoId={c.id} midiasIniciais={(midias ?? []) as Midia[]} capaInicial={c.capa_path} />
        </CardContent>
      </Card>

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Documentos captacaoId={c.id} docsIniciais={(docs ?? []) as Documento[]} />
        </CardContent>
      </Card>

      <Card className="rounded-[18px] border-[#e8e9e3]">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Historico eventos={(eventos ?? []) as never} />
        </CardContent>
      </Card>
      </div>

      <DecisaoBar captacao={c} />
    </main>
  );
}
