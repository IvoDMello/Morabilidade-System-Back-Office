import { Building, DraftingCompass, Landmark, Receipt, ScrollText, type LucideIcon } from "lucide-react";
import type { TipoDocumentoImovel } from "@/types";

/**
 * Flags dos documentos internos do imóvel: os cinco documentos que o corretor
 * precisa juntar. Cada uma tem ícone próprio, usado na aba Documentos (o que
 * já tem e o que falta) e no card da listagem (só as que têm documento).
 *
 * O RGI é guardado como `matricula` (certidão de matrícula do Registro Geral
 * de Imóveis): o valor antigo ficou para não mexer no banco nem no CRM.
 */
export const FLAGS_DOCUMENTO: { tipo: TipoDocumentoImovel; label: string; Icone: LucideIcon }[] = [
  { tipo: "iptu", label: "IPTU", Icone: Receipt },
  { tipo: "matricula", label: "RGI", Icone: Landmark },
  { tipo: "condominio", label: "Condomínio", Icone: Building },
  { tipo: "planta", label: "Planta", Icone: DraftingCompass },
  { tipo: "escritura", label: "Escritura", Icone: ScrollText },
];

/** Todos os tipos, flags primeiro; Contrato e Outro não viram ícone. */
export const TIPOS_DOCUMENTO: { value: TipoDocumentoImovel; label: string }[] = [
  ...FLAGS_DOCUMENTO.map((f) => ({ value: f.tipo, label: f.label })),
  { value: "contrato", label: "Contrato" },
  { value: "outro", label: "Outro" },
];

export const TIPO_DOCUMENTO_LABEL = Object.fromEntries(
  TIPOS_DOCUMENTO.map((t) => [t.value, t.label]),
) as Record<TipoDocumentoImovel, string>;

// Palavras do nome do arquivo que indicam o tipo. "onus" cobre a certidão de
// ônus reais, que é o mesmo documento do RGI.
const PALAVRAS_POR_TIPO: [TipoDocumentoImovel, string[]][] = [
  ["iptu", ["iptu"]],
  ["matricula", ["rgi", "matricula", "onus"]],
  ["condominio", ["condominio"]],
  ["planta", ["planta", "plantas"]],
  ["escritura", ["escritura"]],
  ["contrato", ["contrato"]],
];

/**
 * Tipo sugerido pelo nome do arquivo ("IPTU SAMBAÍBA.jpeg" → iptu), ou null
 * se o nome não diz. Compara palavra inteira, sem acento e sem caixa; números
 * separam palavras ("IPTU2024.pdf" também é IPTU).
 */
export function tipoPeloNomeDoArquivo(nome: string): TipoDocumentoImovel | null {
  const semExtensao = nome.replace(/\.[^.]+$/, "");
  const palavras = new Set(
    semExtensao
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean),
  );
  for (const [tipo, chaves] of PALAVRAS_POR_TIPO) {
    if (chaves.some((c) => palavras.has(c))) return tipo;
  }
  return null;
}
