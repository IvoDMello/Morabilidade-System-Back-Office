import type { CaptacaoInput } from "@/lib/schemas";

/**
 * Captação chegando de fora por link (hoje: o copiloto do WhatsApp).
 *
 * O app irmão não escreve mais direto na tabela — ele manda o que leu da
 * conversa por query string e o cartão só nasce quando alguém confirma o
 * formulário completo daqui. É isso que garante que toda captação passe pelos
 * campos obrigatórios do board e pela checagem de duplicadas.
 *
 * Nada aqui confia no que vem na URL: são só valores iniciais de um formulário
 * que ainda vai ser revisado, validado pelo zod no submit e salvo por um
 * usuário logado.
 */

/** Marca que o link quer abrir o formulário de nova captação. */
export const PARAM_NOVA = "nova";

/** Campos de texto aceitos no link (mesmos nomes das colunas). */
const CAMPOS_TEXTO = [
  "endereco",
  "unidade",
  "bairro",
  "tipo_portaria",
  "proprietario_nome",
  "whatsapp",
  "anuncio_url",
  "observacoes",
  "pendencias",
] as const;

/** Campos numéricos inteiros aceitos no link. */
const CAMPOS_NUMERO = ["andar", "quartos", "suites", "banheiros", "vagas"] as const;

/** Corta valores absurdos: o formulário é para revisão humana, não para colar um livro. */
const MAX_TEXTO = 2000;

function texto(valor: string | null): string | null {
  if (!valor) return null;
  const limpo = valor.trim().slice(0, MAX_TEXTO);
  return limpo || null;
}

function numero(valor: string | null): number | null {
  if (!valor) return null;
  const n = Number(valor);
  // O schema já rejeita fora de 0..99 no submit; aqui só evita levar NaN para
  // dentro do react-hook-form, que renderiza como campo quebrado.
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

/**
 * Lê os valores iniciais do formulário a partir da query string. Devolve
 * `null` quando o link não pede o formulário — assim quem chama não precisa
 * repetir a checagem do parâmetro.
 */
export function defaultsDoLink(params: URLSearchParams): Partial<CaptacaoInput> | null {
  if (params.get(PARAM_NOVA) !== "1") return null;

  const defaults: Record<string, string | number> = {};
  for (const campo of CAMPOS_TEXTO) {
    const valor = texto(params.get(campo));
    if (valor !== null) defaults[campo] = valor;
  }
  for (const campo of CAMPOS_NUMERO) {
    const valor = numero(params.get(campo));
    if (valor !== null) defaults[campo] = valor;
  }
  return defaults as Partial<CaptacaoInput>;
}
