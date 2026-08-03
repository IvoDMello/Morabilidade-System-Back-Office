import { getContactById } from "@/services/contacts.service";
import { createReminder } from "@/services/reminders.service";
import { getCurrentCorretor, getCurrentUserName } from "@/services/corretores.service";
import { criarEventoDeVisita } from "@/services/google-calendar.service";
import { criarCaptacao } from "@/services/captacoes.service";
import { sendMessage } from "@/services/whatsapp.service";
import {
  agendarVisitaArgs,
  criarCaptacaoArgs,
  sugerirRespostaArgs,
  type ToolName,
} from "./tools";
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
  await createReminder({
    contactId: contato.id,
    title: `Visita${tituloImovel}`,
    description: args.observacao ?? null,
    reminderAt: quando.toISOString(),
    createdBy: await getCurrentUserName(),
    corretorId,
    imovelCodigo: codigoImovel,
  });

  await criarEventoDeVisita({
    contactName: contato.name,
    contactPhone: contato.phone,
    when: quando,
    imovelCodigo: codigoImovel,
    observacao: args.observacao ?? null,
  });

  return `Visita agendada com ${contato.name}.`;
}

async function executarCriarCaptacao(rawArgs: unknown): Promise<string> {
  const args = criarCaptacaoArgs.parse(rawArgs);
  const endereco = args.endereco.trim();
  if (!endereco) {
    throw new AcaoInvalidaError("A captação precisa de um endereço.");
  }

  try {
    const captacao = await criarCaptacao({
      endereco,
      quartos: args.quartos ?? null,
      banheiros: args.banheiros ?? null,
      tipoPortaria: args.tipo_portaria ?? null,
      contatoProprietario: args.contato_proprietario ?? null,
      observacoes: args.observacoes ?? null,
    });
    return `Captação criada para "${captacao.endereco}".`;
  } catch (e) {
    throw new AcaoInvalidaError(e instanceof Error ? e.message : "Não foi possível criar a captação.");
  }
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
      return executarCriarCaptacao(rawArgs);
    case "sugerir_resposta":
      return executarSugerirResposta(rawArgs);
    default:
      throw new AcaoInvalidaError("Ação desconhecida.");
  }
}
