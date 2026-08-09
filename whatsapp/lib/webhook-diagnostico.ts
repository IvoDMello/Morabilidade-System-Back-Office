/**
 * Por que uma entrega do webhook foi recusada.
 *
 * A distinção não é burocrática — cada motivo tem uma ação completamente
 * diferente, e sem ela o operador só sabe que "não chega mensagem":
 *
 *  - `sem_segredo`         → falta env na Vercel. Nossa, e rejeita 100%.
 *  - `assinatura_invalida` → segredo diferente do app da Meta. Conferir no
 *                            Business Manager qual app está assinando.
 *  - `erro_processamento`  → assinatura ok, o erro é nosso, depois dela.
 */
export type MotivoRecusa = "sem_segredo" | "assinatura_invalida" | "erro_processamento";

/**
 * Classifica uma recusa de assinatura, ou devolve `null` quando a entrega nem
 * parece ter vindo da Meta.
 *
 * Requisição sem o cabeçalho de assinatura é varredura de internet — o endereço
 * do webhook é público e recebe esse tipo de tráfego. **Não registramos**, e é
 * de propósito: registrar transformaria o livro num log de scanner e destruiria
 * a invariante que o torna útil (toda linha é uma perda real). Nada se perdeu
 * ali; a Meta sempre assina.
 */
export function classificarRecusa(args: {
  temSegredoConfigurado: boolean;
  cabecalhoAssinatura: string | null;
}): MotivoRecusa | null {
  if (!args.cabecalhoAssinatura?.startsWith("sha256=")) return null;
  return args.temSegredoConfigurado ? "assinatura_invalida" : "sem_segredo";
}

/** Frase acionável para cada motivo — o que aparece no painel. */
export const MOTIVO_RECUSA_ACAO: Record<MotivoRecusa, string> = {
  sem_segredo:
    "WHATSAPP_APP_SECRET não está configurada. Enquanto isso, toda mensagem recebida é recusada.",
  assinatura_invalida:
    "A assinatura não confere: WHATSAPP_APP_SECRET está diferente do App Secret da Meta.",
  erro_processamento:
    "A mensagem chegou e o sistema falhou ao gravá-la. A Meta reentrega por um tempo.",
};
