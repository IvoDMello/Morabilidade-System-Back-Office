import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Carrega o manual de voz (`VOZ.md`) que vai literalmente dentro do prompt.
 *
 * Por que arquivo e não string no código: quem ajusta o tom é quem atende, não
 * quem programa. Um `.md` na raiz é editável por qualquer pessoa da operação e
 * ainda fica versionado no git — dá pra ver o que mudou e voltar atrás.
 *
 * Em produção o arquivo é lido uma vez por processo (é conteúdo estável e entra
 * no prefixo cacheado do prompt). Em desenvolvimento relemos a cada chamada,
 * pra dar pra iterar no tom sem reiniciar o servidor.
 *
 * O arquivo precisa ser empacotado no deploy — ver `outputFileTracingIncludes`
 * em `next.config.ts`. Se a leitura falhar por qualquer motivo, caímos no texto
 * mínimo abaixo: o copiloto continua funcionando, só sem a personalização.
 */

const VOZ_PATH = join(process.cwd(), "VOZ.md");

/** Rede de segurança: o essencial que não pode sumir se o arquivo não for lido.
 * São as travas de CRECI — o resto do tom é perda aceitável, isto não é. */
const VOZ_FALLBACK = `Escreva como um corretor experiente escreveria no WhatsApp: frases curtas, direto, educado, sem formalidade de escritório e sem emoji.
Faça uma pergunta por mensagem. Não repita algo que o cliente já respondeu.
NUNCA escreva preço, disponibilidade, condição jurídica ou negociação — nem estimados, nem "por alto". Diga que a equipe confirma e retorna.`;

interface VozCarregada {
  texto: string;
  /** Identifica a versão do manual usada numa proposta (guardado em `voz_hash`).
   * Sem isso não dá pra distinguir "o modelo piorou" de "mexeram no VOZ.md". */
  hash: string;
}

let cache: VozCarregada | null = null;

function ler(): VozCarregada {
  let texto: string;
  try {
    texto = readFileSync(VOZ_PATH, "utf8").trim();
    if (!texto) texto = VOZ_FALLBACK;
  } catch {
    texto = VOZ_FALLBACK;
  }
  return { texto, hash: createHash("sha256").update(texto).digest("hex").slice(0, 12) };
}

export function getVoz(): VozCarregada {
  if (process.env.NODE_ENV !== "production") return ler();
  if (!cache) cache = ler();
  return cache;
}
