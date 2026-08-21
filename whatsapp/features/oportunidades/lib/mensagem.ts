import { TIPO_IMOVEL_LABELS } from "@/constants/oportunidades";
import type { ImovelCompativel } from "@/types/oportunidade";

/**
 * Monta o texto que vai para o cliente com os imóveis escolhidos.
 *
 * Puro e sem React de propósito: o rascunho é sugestão, não decisão. Quem
 * atende lê, corta o que não gostou e manda — o valor está em não precisar
 * abrir o catálogo, copiar código, procurar preço e formatar tudo à mão para
 * cada cliente. É esse trabalho de dez minutos que fazia a lista de
 * oportunidades nunca virar mensagem.
 */

/** Primeiro nome, para o texto soar como gente e não como mala direta. */
export function primeiroNome(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return "";
  // Nomes de exemplo/rótulo ("Exemplo — Comprador") não têm primeiro nome útil.
  const primeiro = limpo.split(/\s+/)[0];
  return primeiro.replace(/[—–-]+$/, "");
}

export function formatarMoeda(valor: number): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    })
      .format(valor)
      // O Intl separa "R$" do número com espaço não-quebrável. Some na tela,
      // mas o texto vai para o WhatsApp e de lá é copiado e colado por gente —
      // um caractere invisível diferente de espaço é o tipo de coisa que
      // reaparece como lixo em planilha e em busca.
      .replace(/ /g, " ")
  );
}

/** Link público do imóvel no site. Null quando NEXT_PUBLIC_SITE_URL não existe. */
export function linkDoImovel(siteUrl: string | null, codigo: string): string | null {
  if (!siteUrl) return null;
  return `${siteUrl.replace(/\/$/, "")}/imoveis/${encodeURIComponent(codigo)}`;
}

/** "3 quartos · 2 vagas" — só o que o imóvel realmente tem preenchido. */
export function comodosDoImovel(imovel: ImovelCompativel): string {
  const partes: string[] = [];
  if (imovel.dormitorios) {
    partes.push(`${imovel.dormitorios} ${imovel.dormitorios === 1 ? "quarto" : "quartos"}`);
  }
  if (imovel.vagasGaragem) {
    partes.push(`${imovel.vagasGaragem} ${imovel.vagasGaragem === 1 ? "vaga" : "vagas"}`);
  }
  return partes.join(" · ");
}

/** O mesmo, com o tipo na frente: "Cobertura · 3 quartos · 2 vagas". */
export function resumoDoImovel(imovel: ImovelCompativel): string {
  const tipo = TIPO_IMOVEL_LABELS[imovel.tipoImovel];
  return [tipo, comodosDoImovel(imovel)].filter(Boolean).join(" · ");
}

export interface RascunhoInput {
  nomeContato: string;
  imoveis: ImovelCompativel[];
  siteUrl: string | null;
}

/**
 * O rascunho completo. Um bloco por imóvel, na ordem em que foram escolhidos.
 *
 * Sem asteriscos de negrito: o mesmo texto é editado numa textarea antes de
 * sair, e marcação que só aparece depois de enviada é marcação que ninguém
 * revisa direito.
 */
export function montarRascunho({ nomeContato, imoveis, siteUrl }: RascunhoInput): string {
  if (imoveis.length === 0) return "";

  const nome = primeiroNome(nomeContato);
  const saudacao = nome ? `Oi, ${nome}!` : "Oi!";
  const abertura =
    imoveis.length === 1
      ? `${saudacao} Separei um imóvel que combina com o que você procura:`
      : `${saudacao} Separei ${imoveis.length} imóveis que combinam com o que você procura:`;

  const blocos = imoveis.map((imovel) => {
    const linhas: string[] = [];
    // O título é o rótulo público do anúncio; sem ele, o resumo (tipo, quartos,
    // vagas) faz as vezes de nome — nunca deixar o cliente com um código solto.
    linhas.push(`${imovel.codigo} — ${imovel.titulo ?? resumoDoImovel(imovel)}`);

    // Quando há título, o tipo já está dito ali: repeti-lo na linha de baixo
    // ("Cobertura em Ipanema" / "Cobertura · 3 quartos") só ocupa espaço.
    const comodos = comodosDoImovel(imovel);
    const detalhe = [imovel.titulo ? comodos : resumoDoImovel(imovel), `${imovel.bairro}, ${imovel.cidade}`]
      .filter(Boolean)
      .join(" · ");
    if (detalhe) linhas.push(detalhe);

    if (imovel.valor !== null) {
      const sufixo = imovel.tipoNegocio === "locacao" ? "/mês" : "";
      linhas.push(`${formatarMoeda(imovel.valor)}${sufixo}`);
    }

    const link = linkDoImovel(siteUrl, imovel.codigo);
    if (link) linhas.push(link);

    return linhas.join("\n");
  });

  const fechamento =
    imoveis.length === 1
      ? "Faz sentido pra você? Posso agendar uma visita."
      : "Algum deles te interessa? Posso agendar uma visita.";

  return [abertura, ...blocos, fechamento].join("\n\n");
}
