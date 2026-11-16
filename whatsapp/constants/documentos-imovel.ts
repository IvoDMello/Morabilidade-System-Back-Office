/** Tipos de documento que o sistema principal guarda por imóvel
 * (migration 042_imovel_documentos.sql da API). */
export const DOCUMENTO_IMOVEL_LABELS: Record<string, string> = {
  contrato: "Contrato",
  matricula: "RGI", // certidão de matrícula do RGI; o painel também chama assim
  iptu: "IPTU",
  escritura: "Escritura",
  planta: "Planta",
  condominio: "Condomínio",
  outro: "Outro",
};

export function rotuloDocumento(tipo: string): string {
  return DOCUMENTO_IMOVEL_LABELS[tipo] ?? DOCUMENTO_IMOVEL_LABELS.outro;
}
