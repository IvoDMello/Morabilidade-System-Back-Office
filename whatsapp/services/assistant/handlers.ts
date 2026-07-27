import { getSupabaseCaptacoesClient } from "@/lib/supabase/server";
import { getContactById } from "@/services/contacts.service";
import { createReminder } from "@/services/reminders.service";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { agendarVisitaArgs, criarCaptacaoArgs, type ToolName } from "./tools";
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

  const tituloImovel = args.imovel_codigo ? ` — ${args.imovel_codigo}` : "";
  await createReminder({
    contactId: contato.id,
    title: `Visita${tituloImovel}`,
    description: args.observacao ?? null,
    reminderAt: quando.toISOString(),
    createdBy: CURRENT_USER_NAME,
  });

  return `Visita agendada com ${contato.name}.`;
}

async function executarCriarCaptacao(rawArgs: unknown): Promise<string> {
  const args = criarCaptacaoArgs.parse(rawArgs);
  const endereco = args.endereco.trim();
  if (!endereco) {
    throw new AcaoInvalidaError("A captação precisa de um endereço.");
  }

  const supabase = getSupabaseCaptacoesClient();
  const { error } = await supabase.from("captacao").insert({
    endereco,
    quartos: args.quartos ?? null,
    banheiros: args.banheiros ?? null,
    tipo_portaria: args.tipo_portaria ?? null,
    contato_proprietario: args.contato_proprietario ?? null,
    observacoes: args.observacoes ?? null,
  });
  if (error) {
    throw new AcaoInvalidaError(`Não foi possível criar a captação: ${error.message}`);
  }
  return `Captação criada para "${endereco}".`;
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
    default:
      throw new AcaoInvalidaError("Ação desconhecida.");
  }
}
