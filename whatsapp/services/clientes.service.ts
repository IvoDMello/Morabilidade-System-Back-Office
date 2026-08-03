import { dataSource } from "./data";
import { fetchClienteByTelefone, isBackofficeConfigured, upsertClienteByTelefone } from "@/lib/backoffice-api";
import { formatPhone } from "@/lib/utils";
import type { ContactCategory } from "@/constants/contact-categories";
import type { ID } from "@/types/common";

/**
 * Promoção de contato do chat para **cliente de verdade** no sistema.
 *
 * O CRM de chat sempre soube consultar clientes, nunca criá-los. Como quase todo
 * lead da imobiliária chega pelo WhatsApp, o efeito era que a maior fonte de
 * leads não alimentava a base: o contato ficava no schema `whatsapp`, invisível
 * para /clientes, relatórios, matching e para a própria ficha de visita — que
 * saía com `cliente_id` nulo justamente para quem tinha visita marcada.
 *
 * A promoção acontece em **evento de compromisso**, nunca por passagem de olho.
 * Abrir uma conversa não cria cliente; agendar visita, sim. Quem decide *quando*
 * são os call sites; o que este módulo decide é *se* aquele contato tem
 * substância suficiente para virar cadastro.
 */

/** Formato mínimo que a promoção precisa conhecer de um contato. */
export interface ContatoPromovivel {
  id: ID;
  name: string;
  phone: string;
  clienteId: string | null;
  category?: ContactCategory;
}

/** Categoria do chat → tipo de cliente do sistema. `lead`, `parceiro` e `outro`
 * não têm equivalente: viram null e o campo fica para um humano classificar. */
const TIPO_POR_CATEGORIA: Partial<
  Record<ContactCategory, "comprador" | "locatario" | "proprietario">
> = {
  proprietario: "proprietario",
  locatario: "locatario",
  cliente: "comprador",
};

/**
 * True se o nome do contato é só o telefone formatado — o que o CRM inventa
 * quando a Meta não manda `profile_name`.
 *
 * Criar cliente assim encheria a base de cadastros chamados "(21) 97195-7245",
 * que ninguém consegue procurar pelo nome e que poluem toda listagem. Melhor
 * esperar alguém identificar a pessoa.
 */
export function nomeEhPlaceholder(name: string, phone: string): boolean {
  const limpo = name.trim();
  if (!limpo) return true;
  if (limpo === formatPhone(phone)) return true;
  // Qualquer nome que seja só dígitos e pontuação de telefone também não serve.
  return /^[\d\s()+\-.]+$/.test(limpo);
}

/**
 * Decide se este contato pode virar cadastro agora. Puro e testável de
 * propósito: é a regra que impede a integração de sujar a base.
 */
export function qualificaParaCliente(contato: ContatoPromovivel): boolean {
  if (contato.clienteId) return false;
  return !nomeEhPlaceholder(contato.name, contato.phone);
}

export interface VinculoCliente {
  clienteId: string;
  clienteCodigo: string | null;
  /** True quando o cadastro nasceu agora (e não já existia). */
  criado: boolean;
}

/**
 * Garante que o contato tenha um cliente do sistema, criando-o se necessário, e
 * persiste o vínculo no contato.
 *
 * Ordem deliberada: **procurar antes de criar**. O upsert da API já faz esse
 * casamento, mas fazê-lo aqui também evita a chamada de escrita no caso comum
 * (cliente já cadastrado) e mantém o comportamento idêntico ao de
 * `ensureClienteVinculo`, que continua sendo o caminho de leitura pura.
 *
 * Best-effort inteiro: devolve null em qualquer falha. Nenhum fluxo do CRM pode
 * quebrar porque o cadastro não pôde ser criado — no pior caso segue-se sem o
 * vínculo, exatamente como antes desta função existir.
 */
export async function garantirClienteDoContato(
  contato: ContatoPromovivel,
  opcoes?: { origemLead?: "whatsapp" | "site"; observacoes?: string | null },
): Promise<VinculoCliente | null> {
  if (contato.clienteId) {
    return { clienteId: contato.clienteId, clienteCodigo: null, criado: false };
  }
  if (!isBackofficeConfigured() || !qualificaParaCliente(contato)) return null;

  try {
    const existente = await fetchClienteByTelefone(contato.phone);
    if (existente) {
      await persistirVinculo(contato.id, existente.id, existente.codigo);
      return { clienteId: existente.id, clienteCodigo: existente.codigo, criado: false };
    }

    const criado = await upsertClienteByTelefone({
      telefone: contato.phone,
      nome: contato.name,
      origemLead: opcoes?.origemLead ?? "whatsapp",
      tipoCliente: contato.category ? TIPO_POR_CATEGORIA[contato.category] ?? null : null,
      observacoes: opcoes?.observacoes ?? null,
    });
    if (!criado) return null;

    await persistirVinculo(contato.id, criado.id, criado.codigo);
    return { clienteId: criado.id, clienteCodigo: criado.codigo, criado: criado.criado };
  } catch (erro) {
    console.error("[clientes] não foi possível garantir o cliente do contato:", erro);
    return null;
  }
}

/** Grava o vínculo no contato. Falhar aqui não desfaz o cadastro criado na API —
 * o casamento por telefone reencontra o cliente na próxima tentativa. */
async function persistirVinculo(
  contactId: ID,
  clienteId: string,
  clienteCodigo: string | null,
): Promise<void> {
  try {
    await dataSource.contacts.update(contactId, { clienteId, clienteCodigo });
  } catch (erro) {
    console.error("[clientes] cadastro criado, mas o vínculo não foi gravado:", erro);
  }
}
