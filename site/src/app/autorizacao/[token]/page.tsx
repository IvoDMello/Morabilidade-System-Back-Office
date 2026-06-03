import type { Metadata } from "next";
import { AssinarAutorizacao } from "@/components/autorizacao/AssinarAutorizacao";

export const metadata: Metadata = {
  title: "Autorização de Intermediação — Morabilidade",
  // Documento privado por token — não deve ser indexado.
  robots: { index: false, follow: false },
};

export default async function AutorizacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AssinarAutorizacao token={token} />;
}
