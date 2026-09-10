import type { Captacao } from "@/types";
import { soDigitos } from "@/lib/format";

/** Mínimo de dígitos para valer a busca: DDD + número (mesma regra do schema). */
const MIN_DIGITOS = 10;

/**
 * Telefone comparável: só dígitos, sem o DDI 55 quando ele sobra.
 *
 * Espelha `captacoes.tel_normalizado` (migration 0012) — é o que faz
 * "(81) 98888-7777", "5581988887777" e "81988887777" baterem entre si.
 */
export function telNormalizado(tel: string | null | undefined): string {
  const d = soDigitos(tel ?? null);
  return d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
}

/**
 * Captações já cadastradas com o mesmo WhatsApp, da mais recente para a mais
 * antiga.
 *
 * Olha só o que o store tem (as captações vivas), porque isso roda a cada
 * tecla digitada no formulário e não pode custar uma ida ao banco. A checagem
 * que segura o cadastro — endereço e anúncio, inclusive na lixeira — continua
 * sendo a RPC `buscar_duplicadas` no submit.
 */
export function captacoesDoTelefone(cards: Captacao[], tel: string | null | undefined): Captacao[] {
  const alvo = telNormalizado(tel);
  if (alvo.length < MIN_DIGITOS) return [];
  return cards
    .filter((c) => telNormalizado(c.whatsapp) === alvo)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

/** Nome do proprietário mais recente registrado para esse número. */
export function nomeDoProprietario(encontradas: Captacao[]): string | null {
  return encontradas.find((c) => c.proprietario_nome?.trim())?.proprietario_nome?.trim() ?? null;
}
