import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron diário (Vercel): marca como arquivada a mídia de captações
 * negativadas/positivadas há mais de RETENCAO_MIDIA_DIAS (default 90).
 *
 * O registro/metadados no banco é SEMPRE preservado, só a mídia migra.
 * A migração física para storage frio é o passo seguinte (ver seção 7 do PRD);
 * aqui marcamos `arquivado_em` para que esses cartões entrem na fila.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dias = Number(process.env.RETENCAO_MIDIA_DIAS ?? 90);
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("captacao")
    .update({ arquivado_em: new Date().toISOString() })
    .in("status", ["negativada", "pendente_agendar_gravacao"])
    .lt("decisao_em", limite)
    .is("arquivado_em", null)
    .is("excluido_em", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ arquivadas: data?.length ?? 0 });
}
