import { dataSource } from "./data";
import type { MotivoRecusa } from "@/lib/webhook-diagnostico";
import type { CreateWebhookDeliveryInput, WebhookFalhaResumo } from "@/types/webhook-delivery";

/**
 * Livro das entregas que o webhook recusou ou não conseguiu processar.
 *
 * Antes disto, uma assinatura inválida devolvia 401 e pronto: a Meta reentregava
 * algumas vezes, desistia, e a mensagem do cliente nunca tinha existido para o
 * sistema. Sem log, sem alerta, sem linha em lugar nenhum. O sintoma que sobrava
 * era "não chega mensagem" — o mesmo sintoma de dez outras causas.
 */

/** Janela do painel. Uma semana basta: o alarme aqui é sobre agora, não sobre
 * arqueologia — se está quebrado há mais de sete dias, o problema não é o gráfico. */
const DIAS_VISIVEIS = 7;

/**
 * Registra uma entrega problemática. **Best-effort e silencioso por contrato:**
 * este é o caminho de erro do webhook, e falhar ao anotar o erro não pode virar
 * um segundo erro. No pior caso voltamos ao comportamento antigo (perder em
 * silêncio) — nunca a um estado pior.
 */
export async function registrarEntregaProblematica(
  input: CreateWebhookDeliveryInput,
): Promise<void> {
  try {
    await dataSource.webhookDeliveries.registrar(input);
  } catch (erro) {
    // Sem a migration 0022 aplicada, cai aqui e o webhook segue igual.
    console.error("[webhook-log] não foi possível registrar a entrega recusada:", erro);
  }
}

/**
 * Falhas recentes agrupadas por motivo, mais graves primeiro.
 *
 * Agrupa porque a informação útil não é "houve 400 recusas" e sim "há 400
 * recusas do mesmo tipo desde terça" — uma lista crua de 400 linhas iguais
 * esconde justamente o `desde`, que é o que diz o tamanho do estrago.
 */
export async function getFalhasDeEntrega(): Promise<WebhookFalhaResumo[]> {
  const desde = new Date(Date.now() - DIAS_VISIVEIS * 24 * 60 * 60 * 1000).toISOString();

  let registros;
  try {
    registros = await dataSource.webhookDeliveries.listRecentes(desde);
  } catch (erro) {
    console.error("[webhook-log] não foi possível ler as falhas de entrega:", erro);
    return [];
  }

  const porMotivo = new Map<MotivoRecusa, WebhookFalhaResumo>();
  for (const registro of registros) {
    const atual = porMotivo.get(registro.motivo);
    if (!atual) {
      porMotivo.set(registro.motivo, {
        motivo: registro.motivo,
        ocorrencias: 1,
        desde: registro.createdAt,
        ultima: registro.createdAt,
      });
      continue;
    }
    atual.ocorrencias++;
    if (registro.createdAt < atual.desde) atual.desde = registro.createdAt;
    if (registro.createdAt > atual.ultima) atual.ultima = registro.createdAt;
  }

  // Problema de configuração vem primeiro: rejeita 100% das mensagens e a
  // correção é uma variável de ambiente, não uma investigação.
  const ordem: MotivoRecusa[] = ["sem_segredo", "assinatura_invalida", "erro_processamento"];
  return [...porMotivo.values()].sort(
    (a, b) => ordem.indexOf(a.motivo) - ordem.indexOf(b.motivo),
  );
}
