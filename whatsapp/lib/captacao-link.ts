/**
 * Hand-off de captação para o board (app irmão `captacoes/`).
 *
 * O CRM não cria mais a captação: ele abre o formulário completo do board já
 * preenchido com o que se sabe da conversa, e o cartão só nasce quando alguém
 * confirma lá. Antes, o botão daqui gravava direto — e nascia um cartão pela
 * metade, sem bairro, sem valores, sem foto e sem passar pela checagem de
 * duplicadas que o board faz no submit.
 *
 * Módulo puro de propósito: roda no cliente (é ele que abre a aba) e por isso
 * recebe a URL do board como argumento em vez de ler `process.env`.
 */

/** O que o CRM consegue saber pela conversa. Os nomes são os das colunas do board. */
export interface CaptacaoRascunho {
  endereco?: string | null;
  quartos?: number | string | null;
  banheiros?: number | string | null;
  tipo_portaria?: string | null;
  proprietario_nome?: string | null;
  whatsapp?: string | null;
  observacoes?: string | null;
}

function limpo(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto || null;
}

/**
 * URL do formulário de nova captação no board, com o rascunho na query string.
 * Devolve `null` quando o board não está configurado (`CAPTACOES_BOARD_URL`) —
 * sem ele não há para onde mandar.
 */
export function linkNovaCaptacao(
  captacoesUrl: string | null,
  rascunho: CaptacaoRascunho,
): string | null {
  if (!captacoesUrl) return null;

  const params = new URLSearchParams({ nova: "1" });
  for (const [campo, valor] of Object.entries(rascunho)) {
    const texto = limpo(valor);
    if (texto) params.set(campo, texto);
  }

  return `${captacoesUrl.replace(/\/$/, "")}/board?${params.toString()}`;
}

/** Converte os argumentos da ferramenta `criar_captacao` da IA em rascunho. */
export function rascunhoDaProposta(args: Record<string, unknown>): CaptacaoRascunho {
  return {
    endereco: limpo(args.endereco),
    quartos: limpo(args.quartos),
    banheiros: limpo(args.banheiros),
    tipo_portaria: limpo(args.tipo_portaria),
    // `contato_proprietario` é o campo livre das propostas antigas, de antes de
    // o board separar nome e WhatsApp — ainda pode haver proposta pendente.
    proprietario_nome: limpo(args.proprietario_nome ?? args.contato_proprietario),
    whatsapp: limpo(args.proprietario_whatsapp),
    observacoes: limpo(args.observacoes),
  };
}
