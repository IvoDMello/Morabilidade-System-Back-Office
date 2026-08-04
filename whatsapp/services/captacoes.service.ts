import { getSupabaseCaptacoesClient } from "@/lib/supabase/server";
import { mockStore } from "@/services/data/mock/store";

/**
 * Ponte de LEITURA com o board de captações (schema `captacoes` do mesmo
 * Supabase — app irmão do monorepo). Serve o painel do copiloto: as captações
 * ligadas ao telefone do contato e as recentes do quadro.
 *
 * SOMENTE LEITURA, de propósito. O CRM já criou captação direto na tabela e o
 * resultado era cartão pela metade — sem bairro, sem valores, sem foto e sem
 * passar pela checagem de duplicadas que o board faz no submit. Hoje o botão
 * daqui monta um rascunho e abre o formulário completo do board (ver
 * `lib/captacao-link.ts`); a captação nasce lá, com quem confirmou.
 *
 * Segue o mesmo `NEXT_PUBLIC_DATA_SOURCE` do resto do painel: em modo mock lê
 * de um board em memória, sem exigir credencial.
 */
const USA_SUPABASE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase";

/** Status do Kanban de captações (espelho de captacoes/src/types — colunas). */
export const CAPTACAO_STATUS_LABEL: Record<string, string> = {
  aguardando_informacoes: "Aguardando informações",
  novas: "Novas",
  em_decisao: "Decisão: aprovar/reprovar",
  pendente_negativa: "Pendente de negativa",
  negativada: "Negativada",
  pendente_agendar_visita: "Pendente agendar visita",
  pendente_agendar_gravacao: "Pendente agendar gravação",
  gaveta: "Gaveta",
  selecao_especial: "Seleção Especial",
  publicada: "Publicada",
};

export interface CaptacaoResumo {
  id: string;
  status: string;
  statusLabel: string;
  endereco: string;
  quartos: number | null;
  banheiros: number | null;
  tipoPortaria: string | null;
  proprietarioNome: string | null;
  proprietarioWhatsapp: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const CAPTACAO_COLUMNS =
  "id, status, endereco, quartos, banheiros, tipo_portaria, proprietario_nome, whatsapp, observacoes, criado_em, atualizado_em";

function mapRow(row: Record<string, unknown>): CaptacaoResumo {
  const status = String(row.status ?? "");
  return {
    id: String(row.id),
    status,
    statusLabel: CAPTACAO_STATUS_LABEL[status] ?? status,
    endereco: String(row.endereco ?? ""),
    quartos: (row.quartos as number) ?? null,
    banheiros: (row.banheiros as number) ?? null,
    tipoPortaria: (row.tipo_portaria as string) ?? null,
    proprietarioNome: (row.proprietario_nome as string) ?? null,
    proprietarioWhatsapp: (row.whatsapp as string) ?? null,
    observacoes: (row.observacoes as string) ?? null,
    criadoEm: String(row.criado_em ?? ""),
    atualizadoEm: String(row.atualizado_em ?? ""),
  };
}

/** Só dígitos, sem DDI 55 — base de comparação entre telefones digitados livremente. */
export function normalizarTelefoneParaBusca(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
}

/**
 * True se o WhatsApp do proprietário na captação é o telefone do contato. O
 * board guarda o número mascarado ("(11) 98888-7777") ou cru, e o CRM guarda
 * com DDI — a comparação é pelos 8 dígitos finais, que é o que sobrevive a
 * máscara, DDI e ao nono dígito do celular.
 */
export function captacaoMencionaTelefone(whatsappProprietario: string | null, phone: string): boolean {
  if (!whatsappProprietario) return false;
  const alvo = normalizarTelefoneParaBusca(phone);
  const doCampo = normalizarTelefoneParaBusca(whatsappProprietario);
  if (alvo.length < 8 || doCampo.length < 8) return false;
  return doCampo.slice(-8) === alvo.slice(-8);
}

/** Captações mais recentes do board (não excluídas), mais novas primeiro. */
export async function listCaptacoesRecentes(limit = 12): Promise<CaptacaoResumo[]> {
  if (!USA_SUPABASE) {
    return [...mockStore.captacoes]
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
      .slice(0, limit);
  }

  const supabase = getSupabaseCaptacoesClient();
  const { data, error } = await supabase
    .from("captacao")
    .select(CAPTACAO_COLUMNS)
    .is("excluido_em", null)
    .order("atualizado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/**
 * Captações cujo WhatsApp do proprietário é o telefone dado. O filtro roda em
 * memória porque o número é gravado com máscara livre nos dois apps (com e sem
 * DDI, com e sem parênteses) — o board é pequeno o suficiente para isso não
 * pesar.
 */
export async function listCaptacoesDoTelefone(phone: string): Promise<CaptacaoResumo[]> {
  if (!USA_SUPABASE) {
    return mockStore.captacoes
      .filter((c) => captacaoMencionaTelefone(c.proprietarioWhatsapp, phone))
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  }

  const supabase = getSupabaseCaptacoesClient();
  const { data, error } = await supabase
    .from("captacao")
    .select(CAPTACAO_COLUMNS)
    .is("excluido_em", null)
    .not("whatsapp", "is", null)
    .order("atualizado_em", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => captacaoMencionaTelefone((row as Record<string, unknown>).whatsapp as string, phone))
    .map(mapRow);
}
