import { dataSource } from "./data";
import { whatsappProvider } from "./whatsapp";
import { criarFichaVisita, fetchImovelByCodigo, isBackofficeConfigured } from "@/lib/backoffice-api";
import { formatPhone } from "@/lib/utils";
import type { VisitaParaFicha } from "@/types/reminder";

/**
 * Ficha de visita automática: 1h antes de cada visita agendada, gera a ficha na
 * API principal e entrega o link de assinatura.
 *
 * A entrega segue a regra da janela de 24h da Meta, nesta ordem:
 *   1. texto livre pro cliente (só entrega se ele falou com a gente nas últimas 24h);
 *   2. template aprovado pro cliente (WHATSAPP_FICHA_TEMPLATE), que vale a qualquer hora;
 *   3. pendência: a mensagem pronta + link vai pros números de plantão
 *      (PENDING_PHONE_NUMBERS), pra alguém encaminhar na mão.
 *
 * Cada visita é notificada UMA vez (marca `ficha_notificada_em` no lembrete),
 * mesmo que o envio falhe — senão o cron horário repetiria a tentativa a cada
 * rodada. A ficha em si nunca é recriada: o id fica guardado no lembrete.
 */

/** Quanto tempo à frente o cron enxerga. O gatilho é horário, então a janela
 * precisa cobrir 60min + a folga de atraso do agendador; com o dedupe, a visita
 * é notificada uma única vez, entre ~30 e ~90 minutos antes. */
const JANELA_MINUTOS = 90;

/** Código de imóvel no título do lembrete ("Visita — MB-00033") — fallback para
 * visitas criadas antes da coluna `imovel_codigo` existir (migration 0019). */
export function extrairCodigoImovel(title: string): string | null {
  const match = /\b([A-Z]{2,4}-\d{3,6})\b/.exec(title.toUpperCase());
  return match ? match[1] : null;
}

/** Números de plantão que recebem as pendências. Aceita 1 ou 2 (ou mais),
 * separados por vírgula; sem a variável, cai no número de alertas. */
export function getPendingPhones(): string[] {
  // Truthiness (não ??): a variável declarada e vazia é o caso comum de painel
  // de env, e ali o certo é cair no número de alertas, não ficar sem ninguém.
  const raw = process.env.PENDING_PHONE_NUMBERS || process.env.ALERT_PHONE_NUMBER || "";
  return raw
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .filter(Boolean);
}

function getSiteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

const horaFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Mensagem que o CLIENTE recebe (texto livre ou parâmetro do template). */
export function montarMensagemCliente(input: {
  contactName: string;
  hora: string;
  endereco: string | null;
  link: string;
}): string {
  const primeiroNome = input.contactName.split(" ")[0] || input.contactName;
  const onde = input.endereco ? ` no imóvel ${input.endereco}` : "";
  return (
    `Olá, ${primeiroNome}! Sua visita está confirmada para hoje às ${input.hora}${onde}. ` +
    `Antes de entrarmos, precisamos da sua ficha de visita assinada — leva menos de 1 minuto: ` +
    `${input.link}`
  );
}

/** Mensagem que o número de PLANTÃO recebe quando o envio direto não é possível. */
function montarMensagemPendencia(input: {
  contactName: string;
  contactPhone: string;
  hora: string;
  endereco: string | null;
  link: string | null;
  motivo: string;
}): string {
  const linhas = [
    `📋 Ficha de visita — ${input.contactName} às ${input.hora}`,
    formatPhone(input.contactPhone),
  ];
  if (input.endereco) linhas.push(input.endereco);
  linhas.push(input.link ? `Link: ${input.link}` : "Link: (não gerado)");
  linhas.push(`Ação: ${input.motivo}`);
  return linhas.join("\n");
}

function toTemplateParam(text: string): string {
  return text.replace(/\n+/g, " | ").replace(/\s+/g, " ").trim().slice(0, 900);
}

/** Envia para o plantão, tentando texto livre e caindo no template de alerta. */
async function enviarParaPlantao(body: string): Promise<number> {
  const phones = getPendingPhones();
  let enviados = 0;
  for (const phone of phones) {
    try {
      await whatsappProvider.sendTextMessage({ toPhone: phone, body });
      enviados++;
    } catch {
      const templateName = process.env.WHATSAPP_ALERT_TEMPLATE;
      if (!templateName) continue;
      try {
        await whatsappProvider.sendTemplateMessage({
          toPhone: phone,
          templateName,
          languageCode: process.env.WHATSAPP_ALERT_TEMPLATE_LANG ?? "pt_BR",
          bodyParams: [toTemplateParam(body)],
        });
        enviados++;
      } catch {
        // Plantão inalcançável nesta rodada; o resultado do job registra a falha.
      }
    }
  }
  return enviados;
}

type Entrega = { destino: "cliente" | "plantao" | "nenhum"; motivo?: string };

/** Passo 1 e 2 da regra de entrega: tenta o cliente, texto livre → template. */
async function tentarEnviarAoCliente(input: {
  phone: string;
  mensagem: string;
  hora: string;
  link: string;
}): Promise<boolean> {
  try {
    await whatsappProvider.sendTextMessage({ toPhone: input.phone, body: input.mensagem });
    return true;
  } catch {
    const templateName = process.env.WHATSAPP_FICHA_TEMPLATE;
    if (!templateName) return false;
    try {
      // Template de utilidade com dois parâmetros: {{1}} hora, {{2}} link.
      await whatsappProvider.sendTemplateMessage({
        toPhone: input.phone,
        templateName,
        languageCode: process.env.WHATSAPP_FICHA_TEMPLATE_LANG ?? "pt_BR",
        bodyParams: [toTemplateParam(input.hora), toTemplateParam(input.link)],
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Gera a ficha (se ainda não existir) e devolve o link de assinatura.
 * Lança com um motivo legível quando falta pré-requisito — o motivo vai
 * literalmente pra pendência do plantão. */
async function garantirFicha(visita: VisitaParaFicha, codigo: string): Promise<{
  fichaId: string;
  link: string;
  endereco: string | null;
}> {
  // A ficha é documento jurídico: nunca emitir uma segunda para a mesma visita.
  // Só chegamos aqui com fichaVisitaId preenchido se a marca de notificação foi
  // limpa à mão para reenviar — aí o link sai do painel, não de uma ficha nova.
  if (visita.fichaVisitaId) {
    throw new Error("já existe ficha gerada para esta visita — reenviar o link pelo painel.");
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL não configurada — gerar a ficha manualmente.");
  if (!isBackofficeConfigured()) {
    throw new Error("integração com a API principal não configurada — gerar a ficha manualmente.");
  }
  if (!visita.corretorAuthUserId) {
    throw new Error(
      "o corretor responsável não está ligado a um login do sistema — gerar a ficha manualmente.",
    );
  }

  const imovel = await fetchImovelByCodigo(codigo);
  if (!imovel?.id) throw new Error(`imóvel ${codigo} não encontrado no sistema.`);

  const ficha = await criarFichaVisita({
    imovelId: imovel.id,
    visitanteNome: visita.contactName,
    visitanteTelefone: visita.contactPhone,
    clienteId: visita.clienteId,
    corretorId: visita.corretorAuthUserId,
  });

  return {
    fichaId: ficha.id,
    link: `${siteUrl}/ficha/${ficha.token}`,
    endereco: ficha.imovelEndereco ?? imovel.titulo ?? imovel.bairro,
  };
}

async function processarVisita(visita: VisitaParaFicha): Promise<Entrega> {
  const hora = horaFmt.format(new Date(visita.reminderAt));
  const codigo = visita.imovelCodigo ?? extrairCodigoImovel(visita.title);

  if (!codigo) {
    const enviados = await enviarParaPlantao(
      montarMensagemPendencia({
        contactName: visita.contactName,
        contactPhone: visita.contactPhone,
        hora,
        endereco: null,
        link: null,
        motivo: "visita sem imóvel vinculado — gerar a ficha manualmente.",
      }),
    );
    return { destino: enviados > 0 ? "plantao" : "nenhum", motivo: "sem imóvel" };
  }

  let ficha: { fichaId: string; link: string; endereco: string | null };
  try {
    ficha = await garantirFicha(visita, codigo);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "falha ao gerar a ficha.";
    const enviados = await enviarParaPlantao(
      montarMensagemPendencia({
        contactName: visita.contactName,
        contactPhone: visita.contactPhone,
        hora,
        endereco: codigo,
        link: null,
        motivo,
      }),
    );
    return { destino: enviados > 0 ? "plantao" : "nenhum", motivo };
  }

  // Guarda o id antes de tentar entregar: se o envio falhar, a ficha já existe
  // e o plantão encaminha o mesmo link em vez de gerar outra.
  await dataSource.reminders.update(visita.reminderId, { fichaVisitaId: ficha.fichaId });

  const mensagem = montarMensagemCliente({
    contactName: visita.contactName,
    hora,
    endereco: ficha.endereco,
    link: ficha.link,
  });

  const entregueAoCliente = await tentarEnviarAoCliente({
    phone: visita.contactPhone,
    mensagem,
    hora,
    link: ficha.link,
  });
  if (entregueAoCliente) return { destino: "cliente" };

  const enviados = await enviarParaPlantao(
    montarMensagemPendencia({
      contactName: visita.contactName,
      contactPhone: visita.contactPhone,
      hora,
      endereco: ficha.endereco ?? codigo,
      link: ficha.link,
      motivo: "janela de 24h fechada — encaminhar o link para o cliente.",
    }),
  );
  return {
    destino: enviados > 0 ? "plantao" : "nenhum",
    motivo: "janela de 24h fechada",
  };
}

export interface FichaVisitaJobResult {
  total: number;
  paraCliente: number;
  paraPlantao: number;
  semEntrega: number;
}

/**
 * Cron horário: para cada visita que começa dentro da janela, gera a ficha e
 * entrega o link. Uma visita problemática nunca derruba as outras — o erro vira
 * pendência e o loop segue.
 */
export async function runFichaVisitaJob(): Promise<FichaVisitaJobResult> {
  const agora = new Date();
  const limite = new Date(agora.getTime() + JANELA_MINUTOS * 60 * 1000);
  const visitas = await dataSource.reminders.listVisitasParaFicha(
    agora.toISOString(),
    limite.toISOString(),
  );

  const resultado: FichaVisitaJobResult = {
    total: visitas.length,
    paraCliente: 0,
    paraPlantao: 0,
    semEntrega: 0,
  };

  for (const visita of visitas) {
    let entrega: Entrega;
    try {
      entrega = await processarVisita(visita);
    } catch {
      entrega = { destino: "nenhum", motivo: "erro inesperado" };
    }

    if (entrega.destino === "cliente") resultado.paraCliente++;
    else if (entrega.destino === "plantao") resultado.paraPlantao++;
    else resultado.semEntrega++;

    // Marca sempre: o cron é horário e não pode reenviar a mesma visita a cada
    // rodada. Uma falha total aparece no resultado do job e no log da Action.
    await dataSource.reminders.update(visita.reminderId, {
      fichaNotificadaEm: new Date().toISOString(),
    });
  }

  return resultado;
}
