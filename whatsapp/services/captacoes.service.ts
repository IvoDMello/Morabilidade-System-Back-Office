import { getSupabaseCaptacoesClient } from "@/lib/supabase/server";

/**
 * Ponte de LEITURA e ESCRITA com o board de captações (schema `captacoes` do
 * mesmo Supabase — app irmão do monorepo). Antes só o assistente escrevia aqui
 * (criar_captacao); agora a tela de conversa também lista as captações do
 * contato e as recentes, e cria novas sem sair do chat.
 *
 * Nada aqui conhece UI: o painel da conversa e o handler do assistente chamam
 * as mesmas funções — uma captação criada pela IA ou pelo formulário passa pelo
 * mesmo caminho.
 */

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
  contatoProprietario: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarCaptacaoInput {
  endereco: string;
  quartos?: number | null;
  banheiros?: number | null;
  tipoPortaria?: string | null;
  contatoProprietario?: string | null;
  observacoes?: string | null;
}

const CAPTACAO_COLUMNS =
  "id, status, endereco, quartos, banheiros, tipo_portaria, contato_proprietario, observacoes, criado_em, atualizado_em";

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
    contatoProprietario: (row.contato_proprietario as string) ?? null,
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
 * True se o campo livre `contato_proprietario` da captação menciona o telefone
 * do contato. O campo aceita qualquer texto ("Maria (11) 98888-7777"), então a
 * comparação é por inclusão dos dígitos — exige ao menos os 8 finais para não
 * casar por acidente com números curtos.
 */
export function captacaoMencionaTelefone(contatoProprietario: string | null, phone: string): boolean {
  if (!contatoProprietario) return false;
  const alvo = normalizarTelefoneParaBusca(phone);
  const doCampo = normalizarTelefoneParaBusca(contatoProprietario);
  if (alvo.length < 8 || doCampo.length < 8) return false;
  return doCampo.slice(-8) === alvo.slice(-8);
}

/** Captações mais recentes do board (não excluídas), mais novas primeiro. */
export async function listCaptacoesRecentes(limit = 12): Promise<CaptacaoResumo[]> {
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
 * Captações cujo contato de proprietário menciona o telefone dado. O filtro
 * roda em memória porque `contato_proprietario` é texto livre (não dá pra
 * comparar dígitos no SQL sem função dedicada) — o board é pequeno o
 * suficiente para isso não pesar.
 */
export async function listCaptacoesDoTelefone(phone: string): Promise<CaptacaoResumo[]> {
  const supabase = getSupabaseCaptacoesClient();
  const { data, error } = await supabase
    .from("captacao")
    .select(CAPTACAO_COLUMNS)
    .is("excluido_em", null)
    .not("contato_proprietario", "is", null)
    .order("atualizado_em", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => captacaoMencionaTelefone((row as Record<string, unknown>).contato_proprietario as string, phone))
    .map(mapRow);
}

/** Cria uma captação no board (coluna inicial do Kanban). */
export async function criarCaptacao(input: CriarCaptacaoInput): Promise<CaptacaoResumo> {
  const endereco = input.endereco.trim();
  if (!endereco) throw new Error("A captação precisa de um endereço.");

  const supabase = getSupabaseCaptacoesClient();
  const { data, error } = await supabase
    .from("captacao")
    .insert({
      endereco,
      quartos: input.quartos ?? null,
      banheiros: input.banheiros ?? null,
      tipo_portaria: input.tipoPortaria?.trim() || null,
      contato_proprietario: input.contatoProprietario?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .select(CAPTACAO_COLUMNS)
    .single();
  if (error) throw new Error(`Não foi possível criar a captação: ${error.message}`);
  return mapRow(data);
}
