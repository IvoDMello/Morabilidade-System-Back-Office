export interface ImovelWhatsApp {
  codigo: string;
  bairro: string;
  cidade?: string | null;
  tipo_imovel?: string | null;
  tipo_negocio?: string | null;
  dormitorios?: number | null;
  valor_venda?: number | null;
  valor_locacao?: number | null;
}

const TIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  cobertura: "Cobertura",
  casa: "Casa",
  kitnet: "Kitnet",
  terreno: "Terreno",
  sala: "Sala",
  galpao: "Galpão",
  loja: "Loja",
  outro: "Imóvel",
};

export function whatsappLink(telefone: string, imovel: ImovelWhatsApp): string {
  const numero = telefone.replace(/\D/g, "");
  const tipo = imovel.tipo_imovel ? (TIPO_LABEL[imovel.tipo_imovel] ?? imovel.tipo_imovel) : "Imóvel";
  const dorms = imovel.dormitorios ? `, ${imovel.dormitorios} dorm.` : "";
  const isLocacao = imovel.tipo_negocio === "locacao";
  const valor = isLocacao ? imovel.valor_locacao : imovel.valor_venda;
  const valorStr = valor ? ` — R$ ${valor.toLocaleString("pt-BR")}` : "";
  const local = imovel.cidade ? `${imovel.bairro}, ${imovel.cidade}` : imovel.bairro;
  const mensagem =
    `Olá! Tenho um imóvel na Morabilidade que combina com o que você procura:\n\n` +
    `*${tipo}${dorms}* em ${local}${valorStr}\n` +
    `Código: *${imovel.codigo}*\n\n` +
    `Posso te enviar mais detalhes e fotos?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
