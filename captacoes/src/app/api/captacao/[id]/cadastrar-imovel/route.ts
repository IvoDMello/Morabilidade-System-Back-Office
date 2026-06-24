import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cadastra, no back-office, o imóvel + proprietário a partir de uma captação aprovada.
 *
 * Fluxo (server-to-server, sem expor service_role nem CORS):
 *   1. valida a sessão do usuário logado e usa o token dele na API (perfil admin/corretor)
 *   2. POST /clientes/  → cria o proprietário
 *   3. POST /imoveis/   → cria o imóvel vinculado ao proprietário
 *   4. marca a captação como cadastrada (imovel_id/codigo) para não duplicar
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const API = process.env.BACKOFFICE_API_URL;
  const INTERNAL_TOKEN = process.env.BACKOFFICE_INTERNAL_TOKEN;
  if (!API || !INTERNAL_TOKEN) {
    const faltam = [
      !API && "BACKOFFICE_API_URL",
      !INTERNAL_TOKEN && "BACKOFFICE_INTERNAL_TOKEN",
    ].filter(Boolean);
    return NextResponse.json(
      { error: `Integração não configurada — variável ausente: ${faltam.join(", ")}.` },
      { status: 500 },
    );
  }

  // Exige apenas que o operador esteja logado no captações; a autenticação na
  // API do back-office é feita server-to-server pelo token de integração.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  const { proprietario, imovel } = (await req.json()) as {
    proprietario: { nome_completo: string; telefone: string };
    imovel: Record<string, unknown>;
  };

  // Idempotência: se a captação já virou imóvel, não cria de novo.
  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("captacao")
    .select("imovel_codigo")
    .eq("id", id)
    .single();
  if (atual?.imovel_codigo) {
    return NextResponse.json(
      { error: `Esta captação já foi cadastrada como imóvel ${atual.imovel_codigo}.` },
      { status: 409 },
    );
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Internal-Token": INTERNAL_TOKEN,
  };

  // 1) Proprietário (cliente).
  const cliRes = await fetch(`${API}/clientes/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nome_completo: proprietario.nome_completo,
      telefone: proprietario.telefone || null,
      tipo_cliente: "proprietario",
      origem_lead: "outro",
    }),
  });
  if (!cliRes.ok) {
    return NextResponse.json(
      { error: `Falha ao criar o proprietário: ${await detalhe(cliRes)}`, etapa: "cliente" },
      { status: cliRes.status },
    );
  }
  const cliente = await cliRes.json();

  // 2) Imóvel vinculado ao proprietário.
  const imoRes = await fetch(`${API}/imoveis/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...imovel, proprietario_id: cliente.id }),
  });
  if (!imoRes.ok) {
    return NextResponse.json(
      {
        error: `Proprietário criado, mas o imóvel falhou: ${await detalhe(imoRes)}`,
        etapa: "imovel",
        proprietario_id: cliente.id,
      },
      { status: imoRes.status },
    );
  }
  const imovelCriado = await imoRes.json();

  // 3) Marca a captação como cadastrada (via admin: independe de RLS).
  await admin
    .from("captacao")
    .update({
      imovel_id: imovelCriado.id,
      imovel_codigo: imovelCriado.codigo,
      cadastrado_em: new Date().toISOString(),
      cadastrado_por: userId ?? null,
    })
    .eq("id", id);

  return NextResponse.json({ codigo: imovelCriado.codigo, id: imovelCriado.id });
}

/** Extrai a mensagem de erro do FastAPI (string ou lista de validação do pydantic). */
async function detalhe(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d: { msg?: string }) => d.msg)
        .filter(Boolean)
        .join("; ");
    }
    return `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
