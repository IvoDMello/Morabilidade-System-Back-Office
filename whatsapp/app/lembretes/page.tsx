import { redirect } from "next/navigation";

interface LembretesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Lembretes virou uma aba de /pendencias. A rota antiga continua de pé porque
 * está em favoritos, no atalho da tela inicial e em links já enviados — some
 * o link, some o acesso. Preserva os filtros que vierem na URL.
 */
export default async function LembretesPage({ searchParams }: LembretesPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (typeof valor === "string") query.set(chave, valor);
  }
  query.set("tab", "lembretes");
  redirect(`/pendencias?${query.toString()}`);
}
