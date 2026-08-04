import { getContactById } from "@/services/contacts.service";
import { createReminder } from "@/services/reminders.service";
import { getCurrentCorretor, getCurrentUserName } from "@/services/corretores.service";
import { criarEventoDeVisita } from "@/services/google-calendar.service";
import { sendMessage } from "@/services/whatsapp.service";
import { agendarVisitaArgs, sugerirRespostaArgs, type ToolName } from "./tools";
import { AcaoInvalidaError, validarHorarioVisita } from "./visita-range";

// A trava de horário da visita vive em ./visita-range (módulo puro, testável).
export { AcaoInvalidaError, validarHorarioVisita };

async function executarAgendarVisita(rawArgs: unknown): Promise<string> {
  const args = agendarVisitaArgs.parse(rawArgs);
  const contato = await getContactById(args.contato_id);
  if (!contato) {
    throw new AcaoInvalidaError("Contato não encontrado para agendar a visita.");
  }
  const quando = validarHorarioVisita(args.data_hora);

  // A visita fica com o responsável pelo contato; sem responsável, cai no
  // corretor logado (se o login estiver ligado a um corretor).
  const corretorId = contato.corretorId ?? (await getCurrentCorretor())?.id ?? null;

  // O código também vai numa coluna própria: é o que o cron da ficha de visita
  // usa para resolver o imóvel na API principal (ver ficha-visita.service.ts).
  const codigoImovel = args.imovel_codigo?.trim().toUpperCase() || null;
  const tituloImovel = codigoImovel ? ` — ${codigoImovel}` : "";

  // Cria o evento antes do lembrete pra já guardar o ID do evento junto —
  // é o que permite apagar o evento quando o lembrete for excluído do CRM.
  const googleCalendarEventId = await criarEventoDeVisita({
    contactName: contato.name,
    contactPhone: contato.phone,
    when: quando,
    imovelCodigo: codigoImovel,
    observacao: args.observacao ?? null,
  });

  await createReminder({
    contactId: contato.id,
    title: `Visita${tituloImovel}`,
    description: args.observacao ?? null,
    reminderAt: quando.toISOString(),
    createdBy: await getCurrentUserName(),
    corretorId,
    imovelCodigo: codigoImovel,
    googleCalendarEventId,
  });

  return `Visita agendada com ${contato.name}.`;
}


async function executarSugerirResposta(rawArgs: unknown): Promise<string> {
  const args = sugerirRespostaArgs.parse(rawArgs);
  const texto = args.texto.trim();
  if (!texto) {
    throw new AcaoInvalidaError("A resposta sugerida está vazia.");
  }
  const contato = await getContactById(args.contato_id);
  if (!contato) {
    throw new AcaoInvalidaError("Contato não encontrado para enviar a resposta.");
  }
  await sendMessage(contato.id, texto);
  return `Mensagem enviada para ${contato.name}.`;
}

/**
 * Executa uma ação JÁ CONFIRMADA pelo operador. Valida os argumentos e o range
 * de novo aqui (nunca confiar na proposta do modelo). Retorna uma mensagem de
 * sucesso ou lança AcaoInvalidaError com o motivo.
 */
export async function executarAcao(tool: ToolName, rawArgs: unknown): Promise<string> {
  switch (tool) {
    case "agendar_visita":
      return executarAgendarVisita(rawArgs);
    case "criar_captacao":
      // Captação não é executada no servidor: a confirmação abre o formulário
      // completo do board, e o cartão nasce lá (ver lib/captacao-link.ts). Se
      // esta linha for alcançada, alguém religou o caminho antigo — falhar aqui
      // é melhor que voltar a criar cartão pela metade sem ninguém perceber.
      throw new AcaoInvalidaError(
        "Captação agora é criada no board: confirme a proposta para abrir o formulário completo.",
      );
    case "sugerir_resposta":
      return executarSugerirResposta(rawArgs);
    default:
      throw new AcaoInvalidaError("Ação desconhecida.");
  }
}
