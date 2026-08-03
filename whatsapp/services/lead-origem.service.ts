import { dataSource } from "./data";
import { getContactByPhone } from "./contacts.service";
import { garantirClienteDoContato, type ContatoPromovivel } from "./clientes.service";
import { extrairCodigoImovel, pareceLeadDoSite } from "@/lib/imovel-codigo";
import { fetchImovelByCodigo, isBackofficeConfigured } from "@/lib/backoffice-api";

/**
 * Aproveita o rastro que a primeira mensagem já traz.
 *
 * O botão do site público monta o texto com o imóvel dentro:
 *   "Olá! Tenho interesse no imóvel *Cobertura em Ipanema* (código *MB-00033*)."
 *
 * Essa mensagem chegava e era tratada como qualquer outra: o código ia para o
 * corpo da conversa e morria ali. Ninguém sabia de qual imóvel o lead falava sem
 * ler o histórico, e a origem do lead — que estava escrita na própria mensagem —
 * se perdia. Era a atribuição mais barata do sistema, jogada fora.
 *
 * Tudo aqui é best-effort e roda fora do caminho da resposta ao webhook: a
 * mensagem do cliente já está gravada, e é isso que não pode se perder.
 */

export interface RastroDaMensagem {
  /** Código confirmado no catálogo (null quando não havia ou não existe). */
  imovelCodigo: string | null;
  /** True se o contato passou a ter o imóvel vinculado agora. */
  vinculouImovel: boolean;
  /** True se o lead entrou no cadastro do sistema por causa desta mensagem. */
  criouCliente: boolean;
}

const VAZIO: RastroDaMensagem = {
  imovelCodigo: null,
  vinculouImovel: false,
  criouCliente: false,
};

/**
 * Lê o rastro de uma mensagem recebida e registra o que ela revela.
 *
 * O código só vira vínculo depois de **confirmado no catálogo**: é a consulta à
 * API, não o formato do texto, que decide. Assim um "CEP-01234" digitado por
 * acaso não cria um imóvel fantasma no CRM.
 */
export async function registrarRastroDaMensagem(
  contato: ContatoPromovivel,
  corpo: string | null,
): Promise<RastroDaMensagem> {
  const codigo = extrairCodigoImovel(corpo);
  if (!codigo || !isBackofficeConfigured()) return VAZIO;

  try {
    const imovel = await fetchImovelByCodigo(codigo);
    // Código que não existe no catálogo: era coincidência de texto, não imóvel.
    if (!imovel) return VAZIO;

    const vinculouImovel = await vincularImovelAoContato(contato.id, imovel.codigo, imovel.titulo);

    // Quem chegou pelo botão do site perguntando por um imóvel específico tem
    // intenção declarada e identidade: é lead de verdade, e este é o único
    // momento em que dá para gravar que ele veio do site.
    const vinculo = await garantirClienteDoContato(contato, {
      origemLead: pareceLeadDoSite(corpo) ? "site" : "whatsapp",
      observacoes: `Primeiro contato sobre o imóvel ${imovel.codigo}${
        imovel.titulo ? ` (${imovel.titulo})` : ""
      }.`,
    });

    return {
      imovelCodigo: imovel.codigo,
      vinculouImovel,
      criouCliente: Boolean(vinculo?.criado),
    };
  } catch (erro) {
    console.error("[lead-origem] não foi possível registrar o rastro da mensagem:", erro);
    return VAZIO;
  }
}

/**
 * Entrada do webhook: resolve o contato pelo telefone e registra o rastro.
 * Best-effort por contrato, igual à análise do copiloto — devolve o resultado
 * vazio em vez de lançar, porque a mensagem já está gravada.
 */
export async function registrarRastroDoTelefone(
  phone: string,
  corpo: string | null,
): Promise<RastroDaMensagem> {
  try {
    const contato = await getContactByPhone(phone);
    if (!contato) return VAZIO;
    return await registrarRastroDaMensagem(contato, corpo);
  } catch (erro) {
    console.error("[lead-origem] rastro automático falhou:", erro);
    return VAZIO;
  }
}

/**
 * Cria (ou reusa) o imóvel local e liga ao contato como interesse. Devolve
 * false quando o vínculo já existia — o cliente pode citar o mesmo código dez
 * vezes na conversa, e só a primeira é novidade.
 */
async function vincularImovelAoContato(
  contactId: string,
  codigo: string,
  titulo: string | null,
): Promise<boolean> {
  const jaVinculados = await dataSource.properties.listByContact(contactId);
  if (jaVinculados.some((p) => p.code.toUpperCase() === codigo.toUpperCase())) return false;

  const imovelLocal = await dataSource.properties.create({ code: codigo, title: titulo });
  await dataSource.properties.addToContact(contactId, imovelLocal.id, "interesse", "interesse");

  await dataSource.events
    .create({
      contactId,
      type: "property_linked",
      summary: `Imóvel ${codigo} vinculado pela mensagem do cliente`,
    })
    .catch(() => {
      // A timeline é conveniência; o vínculo em si é o que importa.
    });

  return true;
}
