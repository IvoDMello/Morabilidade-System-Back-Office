import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, User, Link2 } from "lucide-react";
import { whatsappLink, formatarTelefone, formatBRL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditCaptacao } from "@/components/captacao/EditCaptacao";
import { DecisaoBox } from "@/components/captacao/DecisaoBox";
import { Agendamento } from "@/components/captacao/Agendamento";
import { Galeria } from "@/components/captacao/Galeria";
import { Documentos } from "@/components/captacao/Documentos";
import { ExcluirCaptacao } from "@/components/captacao/ExcluirCaptacao";
import { Historico } from "@/components/captacao/Historico";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_TONE, type Captacao, type Documento, type Midia } from "@/types";

const TONE_BADGE: Record<string, "muted" | "default" | "secondary" | "destructive" | "positive"> = {
  muted: "muted",
  primary: "default",
  secondary: "secondary",
  destructive: "destructive",
  positive: "positive",
};

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

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/board" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao quadro
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={TONE_BADGE[STATUS_TONE[c.status]]}>{STATUS_LABEL[c.status]}</Badge>
          <ExcluirCaptacao id={c.id} />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold leading-tight">{c.endereco}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {c.proprietario_nome && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4" /> {c.proprietario_nome}
            </span>
          )}
          {c.whatsapp && whatsappLink(c.whatsapp) && (
            <a
              href={whatsappLink(c.whatsapp)!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-positive/10 px-2.5 py-1 font-medium text-positive transition-colors hover:bg-positive/20"
            >
              <MessageCircle className="h-4 w-4" /> {formatarTelefone(c.whatsapp)}
            </a>
          )}
          {c.anuncio_url && (
            <a
              href={c.anuncio_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Link2 className="h-4 w-4" /> Ver anúncio
            </a>
          )}
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Dados da captação</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCaptacao captacao={c} />
        </CardContent>
      </Card>

      {(c.status === "em_decisao" || c.decisao) && (
        <Card>
          <CardHeader>
            <CardTitle>Decisão</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisaoBox captacao={c} />
          </CardContent>
        </Card>
      )}

      {ramoAgendamento && (
        <Card>
          <CardHeader>
            <CardTitle>Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Agendamento captacao={c} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fotos e vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          <Galeria captacaoId={c.id} midiasIniciais={(midias ?? []) as Midia[]} capaInicial={c.capa_path} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Documentos captacaoId={c.id} docsIniciais={(docs ?? []) as Documento[]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Historico eventos={(eventos ?? []) as never} />
        </CardContent>
      </Card>
    </main>
  );
}
