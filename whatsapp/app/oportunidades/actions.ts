"use server";

import { revalidatePath } from "next/cache";
import { preferenciaFormSchema, type PreferenciaFormValues } from "@/lib/validations/preferencia.schema";
import { messageFormSchema } from "@/lib/validations/message.schema";
import { registrarImoveisEnviados, salvarPreferencia } from "@/services/oportunidades.service";
import { sendMessage } from "@/services/whatsapp.service";
import type { ID } from "@/types/common";

export interface AcaoResultado {
  ok: boolean;
  erro?: string;
  aviso?: string;
}

/**
 * Salva o que o cliente procura. É a peça que faltava para a lista de
 * oportunidades sair do zero: o perfil de busca só existia no back-office, e
 * quem fala com o cliente é quem descobre o que ele quer.
 */
export async function salvarPreferenciaAction(
  contactId: ID,
  values: PreferenciaFormValues,
): Promise<AcaoResultado> {
  const parsed = preferenciaFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os campos." };
  }

  const resultado = await salvarPreferencia(contactId, parsed.data);
  if (!resultado.ok) return { ok: false, erro: resultado.erro };

  revalidatePath("/oportunidades");
  revalidatePath(`/contatos/${contactId}`);
  return {
    ok: true,
    aviso: resultado.clienteCriado
      ? "Perfil salvo. Este contato também entrou na base de clientes do sistema."
      : undefined,
  };
}

/**
 * Envia o rascunho pelo WhatsApp e registra no CRM o que foi oferecido.
 *
 * Passa pelo `sendMessage` de sempre — mesma conversa, mesma thread, mesmo
 * tratamento de falha. Fora da janela de 24h a Meta recusa, e o erro devolvido
 * aqui é o que ela disse: a tela já avisa antes, mas quem insiste merece saber
 * por que não foi.
 */
export async function enviarImoveisAction(
  contactId: ID,
  texto: string,
  imoveis: { codigo: string; titulo: string | null }[],
): Promise<AcaoResultado> {
  const parsed = messageFormSchema.safeParse({ body: texto });
  if (!parsed.success) {
    return { ok: false, erro: "Escreva a mensagem antes de enviar." };
  }

  try {
    await sendMessage(contactId, parsed.data.body);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : "";
    return {
      ok: false,
      erro: motivo || "O WhatsApp recusou o envio. Confira a conversa e tente de novo.",
    };
  }

  await registrarImoveisEnviados(contactId, imoveis);

  revalidatePath("/oportunidades");
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
  return { ok: true };
}
