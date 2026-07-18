import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

// Revalidação on-demand: o back-office (via API) chama este endpoint logo após
// criar/editar/excluir um imóvel, para que a mudança apareça no site na hora
// sem esperar o cache ISR expirar. Protegido por um segredo compartilhado.
//
// Contrato: POST /api/revalidate
//   header  x-revalidate-secret: <REVALIDATE_SECRET>
//   body    { "codigo"?: "MB-00043" }
// Se vier `codigo`, revalida a página daquele imóvel; sempre revalida a
// listagem e a home (que mostram destaques/cards).

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, error: "REVALIDATE_SECRET não configurado" },
      { status: 500 },
    );
  }
  if (req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json(
      { revalidated: false, error: "Não autorizado" },
      { status: 401 },
    );
  }

  let codigo: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.codigo === "string") codigo = body.codigo;
  } catch {
    // body vazio/inválido é aceitável, revalida só listagem e home
  }

  const paths = ["/", "/imoveis"];
  if (codigo) paths.push(`/imoveis/${codigo}`);
  paths.forEach((p) => revalidatePath(p));

  // A lista de bairros tem cache longo (1 dia) e não é purgada de forma
  // confiável por revalidatePath; revalida pela tag para um imóvel em bairro
  // inédito aparecer no filtro imediatamente.
  revalidateTag("bairros");

  return NextResponse.json({ revalidated: true, paths });
}
