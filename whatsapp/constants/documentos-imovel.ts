/** Tipos de documento que o sistema principal guarda por imóvel
 * (migration 042_imovel_documentos.sql da API). */
export const DOCUMENTO_IMOVEL_LABELS: Record<string, string> = {
  contrato: "Contrato",
  matricula: "Matrícula",
  iptu: "IPTU",
  escritura: "Escritura",
  planta: "Planta",
  condominio: "Condomínio",
  outro: "Outro",
};

export function rotuloDocumento(tipo: string): string {
  return DOCUMENTO_IMOVEL_LABELS[tipo] ?? DOCUMENTO_IMOVEL_LABELS.outro;
}
