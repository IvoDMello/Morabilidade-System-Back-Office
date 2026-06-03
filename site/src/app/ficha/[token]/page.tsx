import type { Metadata } from "next";
import { AssinarFicha } from "@/components/ficha/AssinarFicha";

export const metadata: Metadata = {
  title: "Ficha de Visita — Morabilidade",
  // Documento privado por token — não deve ser indexado.
  robots: { index: false, follow: false },
};

export default async function FichaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AssinarFicha token={token} />;
}
