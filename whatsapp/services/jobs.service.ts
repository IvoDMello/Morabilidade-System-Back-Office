import { dataSource } from "./data";
import { whatsappProvider } from "./whatsapp";
import { getPendingQueue } from "./whatsapp.service";
import { gerarAnalisePendenciasDoDia, type PendenciaDoDia } from "./ai.service";
import { startOfDaySaoPaulo } from "@/lib/timezone";
import { formatPhone } from "@/lib/utils";
import { formatWaitTime } from "@/lib/wait-time";

const MAX_FOLLOW_UPS_LISTED = 5;
const MAX_PENDENCIAS_LISTED = 8;

const URGENCIA_ICON: Record<PendenciaDoDia["urgencia"], string> = {
  alta: "🔴",
  media: "🟡",
  baixa: "⚪",
};

/**
 * Fase 1 do assistente: seção de IA no resumo diário. Best-effort — qualquer
 * falha (sem ANTHROPIC_API_KEY, erro de rede, quota) retorna string vazia para
 * o resumo sair sem a seção, nunca derrubando o job.
 */
async function buildPendenciasSection(todayStartIso: string): Promise<string> {
  let pendencias: PendenciaDoDia[];
  try {
    pendencias = await gerarAnalisePendenciasDoDia(todayStartIso);
  } catch {
    return "";
  }
  if (pendencias.length === 0) return "";

  // Ordena por urgência (alta → baixa) e corta o excesso.
  const ordem: Record<PendenciaDoDia["urgencia"], number> = { alta: 0, media: 1, baixa: 2 };
  const ordenadas = [...pendencias]
    .sort((a, b) => ordem[a.urgencia] - ordem[b.urgencia])
    .slice(0, MAX_PENDENCIAS_LISTED);

  const linhas = [`\n🤖 Assistente — ${ordenadas.length} ${pluralize(ordenadas.length, "ponto de atenção", "pontos de atenção")}:`];
  for (const p of ordenadas) {
    linhas.push(`${URGENCIA_ICON[p.urgencia]} ${p.contato}: ${p.motivo}`);
  }
  return linhas.join("\n");
}

const FOLLOW_UP_COOLDOWN_DAYS = 3;
const AWAITING_ALERT_HOURS = 2;

/** Parâmetros de template não aceitam quebra de linha, tab ou 4+ espaços
 * seguidos (regra da Meta) — achata o texto e limita o tamanho. */
function toTemplateParam(text: string): string {
  return text.replace(/\n+/g, " | ").replace(/\s+/g, " ").trim().slice(0, 900);
}

/**
 * Envia um alerta operacional pro time. Texto livre só entrega se o
 * destinatário tiver janela de 24h aberta com o número; se falhar e houver um
 * template aprovado configurado (WHATSAPP_ALERT_TEMPLATE, com um único {{1}}
 * no corpo), reenvia como template — que a Meta aceita a qualquer hora.
 */
async function sendAlertMessage(toPhone: string, body: string) {
  try {
    await whatsappProvider.sendTextMessage({ toPhone, body });
    return;
  } catch (error) {
    const templateName = process.env.WHATSAPP_ALERT_TEMPLATE;
    if (!templateName) throw error;

    await whatsappProvider.sendTemplateMessage({
      toPhone,
      templateName,
      languageCode: process.env.WHATSAPP_ALERT_TEMPLATE_LANG ?? "pt_BR",
      bodyParams: [toTemplateParam(body)],
    });
  }
}

/** Fase 3: conversas "respondida" que esfriaram (cliente sumiu há 3+ dias) viram follow_up_sugerido. */
export async function runFollowUpCooldownJob() {
  const cutoff = new Date(Date.now() - FOLLOW_UP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const changed = await dataSource.whatsapp.markStaleRespondidasAsFollowUp(cutoff);
  return { changed };
}

/**
 * Fase 3: alerta via WhatsApp (pro meu número) para cada conversa aguardando
 * resposta há mais de 2h, no máximo uma vez por dia por conversa. Envio é
 * best-effort (texto livre → fallback de template, ver sendAlertMessage) —
 * mesmo numa falha, marcamos o alerta como enviado pra não tentar de novo
 * até amanhã.
 */
export async function runAwaitingAlertJob() {
  const alertPhone = process.env.ALERT_PHONE_NUMBER;
  if (!alertPhone) {
    return { sent: 0, failed: 0, total: 0, skippedReason: "ALERT_PHONE_NUMBER não configurado" as const };
  }

  const alertCutoff = new Date(Date.now() - AWAITING_ALERT_HOURS * 60 * 60 * 1000).toISOString();
  const todayStart = startOfDaySaoPaulo().toISOString();
  const overdue = await dataSource.whatsapp.listOverdueAwaiting(alertCutoff, todayStart);

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const conversation of overdue) {
    try {
      await sendAlertMessage(
        alertPhone,
        `⏰ ${conversation.contactName} está aguardando resposta há mais de 2h.\n${formatPhone(conversation.contactPhone)}`,
      );
      sent++;
    } catch {
      failed++;
    } finally {
      await dataSource.whatsapp.markAlerted(conversation.id, now);
    }
  }

  return { sent, failed, total: overdue.length };
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Fase 4: monta o texto do resumo diário a partir do estado atual do banco. */
export async function buildDailySummaryText(): Promise<string> {
  const [queue, conversations] = await Promise.all([
    getPendingQueue(),
    dataSource.whatsapp.listConversations(),
  ]);

  const { aguardandoResposta, followUpSugerido } = queue;
  const todayStartDate = startOfDaySaoPaulo();
  const todayStart = todayStartDate.getTime();
  const newToday = conversations.filter(
    (c) => new Date(c.createdAt).getTime() >= todayStart,
  ).length;

  // Análise de IA das conversas de hoje (best-effort — string vazia se falhar
  // ou se estiver tudo em dia). Roda em paralelo com a montagem do resumo.
  const pendenciasSection = await buildPendenciasSection(todayStartDate.toISOString());

  const semPendencias = aguardandoResposta.length === 0 && followUpSugerido.length === 0;
  if (semPendencias) {
    // A fila está limpa, mas a IA ainda pode ter achado uma promessa não
    // cumprida ou uma pergunta sem resposta numa conversa "respondida".
    if (!pendenciasSection) {
      return "Resumo do dia — Morabilidade\n\nTudo em dia, sem conversas pendentes. 👍";
    }
    return `Resumo do dia — Morabilidade\n\nA fila está limpa, mas o assistente encontrou alguns pontos de atenção:\n${pendenciasSection}`;
  }

  const lines: string[] = ["Resumo do dia — Morabilidade"];

  if (aguardandoResposta.length > 0) {
    const oldest = aguardandoResposta[0];
    const waitDate = oldest.lastInboundAt ?? oldest.lastMessageAt;
    lines.push(
      `\n⏳ ${aguardandoResposta.length} ${pluralize(aguardandoResposta.length, "conversa aguardando resposta", "conversas aguardando resposta")}` +
        (waitDate ? `, a mais antiga espera ${formatWaitTime(waitDate)}.` : "."),
    );
  } else {
    lines.push("\nNenhuma conversa aguardando resposta.");
  }

  if (followUpSugerido.length > 0) {
    lines.push(
      `\n🔁 ${followUpSugerido.length} ${pluralize(followUpSugerido.length, "follow-up sugerido", "follow-ups sugeridos")}:`,
    );
    for (const item of followUpSugerido.slice(0, MAX_FOLLOW_UPS_LISTED)) {
      const propertyLabel = item.property
        ? ` (${item.property.code}${item.property.title ? " · " + item.property.title : ""})`
        : "";
      lines.push(`- ${item.contactName}${propertyLabel}`);
    }
    const remaining = followUpSugerido.length - MAX_FOLLOW_UPS_LISTED;
    if (remaining > 0) lines.push(`e mais ${remaining}.`);
  }

  lines.push(
    `\n🆕 ${newToday} ${pluralize(newToday, "conversa nova", "conversas novas")} hoje.`,
  );

  if (pendenciasSection) lines.push(pendenciasSection);

  return lines.join("\n");
}

/** Fase 4: gera e envia o resumo diário (18h America/Sao_Paulo) pro ALERT_PHONE_NUMBER. */
export async function runDailySummaryJob() {
  const summaryText = await buildDailySummaryText();
  const alertPhone = process.env.ALERT_PHONE_NUMBER;

  if (!alertPhone) {
    return { sent: false, summaryText, skippedReason: "ALERT_PHONE_NUMBER não configurado" as const };
  }

  try {
    await sendAlertMessage(alertPhone, summaryText);
    return { sent: true, summaryText };
  } catch {
    return { sent: false, summaryText };
  }
}
