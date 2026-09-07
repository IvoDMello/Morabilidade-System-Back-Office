import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apagarEvento, calendarioConfigurado, salvarEvento } from "@/lib/google-calendar";
import { fimDoCompromisso } from "@/lib/agendamento";
import type { Captacao } from "@/types";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  captacaoId: z.string().uuid(),
  tipo: z.enum(["visita", "gravacao"]),
  /** ISO com fuso; null desmarca o compromisso. */
  quando: z.string().datetime({ offset: true }).nullable(),
  duracaoMin: z.number().int().min(15).max(480).default(60),
});

const LABEL = { visita: "Visita", gravacao: "Gravação" } as const;

/**
 * Agenda (ou desmarca) visita/gravação e espelha na Google Agenda da empresa.
 *
 * Roda no servidor porque as credenciais do Google não podem ir para o
 * cliente. A gravação no banco acontece SEMPRE; o evento é best-effort, e a
 * resposta diz se ele entrou (`naAgenda`) para a interface avisar sem
 * bloquear nada.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }
  const { captacaoId, tipo, quando, duracaoMin } = parsed.data;

  const { data: captacao, error: erroLeitura } = await supabase
    .from("captacao")
    .select("*")
    .eq("id", captacaoId)
    .single();

  if (erroLeitura || !captacao) {
    return NextResponse.json({ error: "captação não encontrada" }, { status: 404 });
  }
  const c = captacao as Captacao;

  const campoEm = tipo === "visita" ? "visita_em" : "gravacao_em";
  const campoData = tipo === "visita" ? "visita_data" : "gravacao_data";
  const campoDuracao = tipo === "visita" ? "visita_duracao_min" : "gravacao_duracao_min";
  const campoEvento = tipo === "visita" ? "visita_google_event_id" : "gravacao_google_event_id";
  const eventoAtual = tipo === "visita" ? c.visita_google_event_id : c.gravacao_google_event_id;

  // Desmarcar: limpa os campos e apaga o evento espelhado.
  if (quando === null) {
    if (eventoAtual) await apagarEvento(eventoAtual);
    const { error } = await supabase
      .from("captacao")
      .update({ [campoEm]: null, [campoData]: null, [campoEvento]: null })
      .eq("id", captacaoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, naAgenda: false });
  }

  const endereco = [c.endereco, c.unidade].filter(Boolean).join(" / ");
  const eventId = await salvarEvento(
    {
      titulo: `${LABEL[tipo]} — ${endereco}`,
      descricao: [
        c.bairro ? `Bairro: ${c.bairro}` : null,
        c.proprietario_nome ? `Proprietário: ${c.proprietario_nome}` : null,
        c.whatsapp ? `WhatsApp: ${c.whatsapp}` : null,
        c.imovel_codigo ? `Imóvel: ${c.imovel_codigo}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      inicio: quando,
      fim: fimDoCompromisso(quando, duracaoMin),
    },
    eventoAtual
  );

  // `*_data` continua populada: é o que a v1 lê e o que sustenta a
  // contabilidade de gravações. Ver migration 0023.
  const { error } = await supabase
    .from("captacao")
    .update({
      [campoEm]: quando,
      [campoData]: quando.slice(0, 10),
      [campoDuracao]: duracaoMin,
      [campoEvento]: eventId,
    })
    .eq("id", captacaoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    naAgenda: eventId !== null,
    configurado: calendarioConfigurado(),
  });
}
