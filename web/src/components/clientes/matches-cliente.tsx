"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Building2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";

interface Match {
  imovel_id: string;
  codigo: string;
  cidade: string;
  bairro: string;
  tipo_imovel: string;
  tipo_negocio: string;
  valor_venda?: number;
  valor_locacao?: number;
  dormitorios?: number;
  foto_capa?: string;
}

interface Props {
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
}

const TIPO_IMOVEL_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  cobertura: "Cobertura",
  casa: "Casa",
  kitnet: "Kitnet",
  terreno: "Terreno",
  sala: "Sala",
  galpao: "Galpão",
  loja: "Loja",
  outro: "Outro",
};

function whatsappLink(telefone: string, codigo: string, bairro: string) {
  const numero = telefone.replace(/\D/g, "");
  const mensagem = `Olá! Apareceu um imóvel na Morabilidade que combina com o que você procura: ${TIPO_IMOVEL_LABEL[bairro] ?? ""} código *${codigo}* em ${bairro}. Posso te mandar mais detalhes?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

export function MatchesCliente({ clienteId, clienteNome, clienteTelefone }: Props) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Match[]>(`/clientes/${clienteId}/matches`)
      .then((r) => setMatches(r.data))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) {
    return <p className="text-xs text-slate-400">Buscando oportunidades…</p>;
  }

  if (!matches || matches.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nenhuma oportunidade no momento. Quando um imóvel novo entrar que combine
        com a preferência deste cliente, ele vai aparecer aqui.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-amber-500" />
        {matches.length} imóvel{matches.length !== 1 ? "is" : ""} disponível{matches.length !== 1 ? "is" : ""} casa{matches.length === 1 ? "" : "m"} com a preferência de <strong>{clienteNome}</strong>:
      </p>
      <div className="space-y-2">
        {matches.map((m) => {
          const valor = m.tipo_negocio === "locacao" ? m.valor_locacao : m.valor_venda;
          return (
            <div
              key={m.imovel_id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
            >
              <div className="w-12 h-12 rounded-md bg-slate-200 overflow-hidden flex-shrink-0">
                {m.foto_capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.foto_capa} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  <span className="font-mono">{m.codigo}</span> · {TIPO_IMOVEL_LABEL[m.tipo_imovel] ?? m.tipo_imovel}
                </p>
                <p className="text-xs text-slate-500">
                  {m.bairro}, {m.cidade}
                  {m.dormitorios ? ` · ${m.dormitorios} dorm.` : ""}
                  {valor ? ` · ${formatarMoeda(valor)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href={`/imoveis/${m.imovel_id}`}
                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-[#585a4f] hover:bg-white rounded-md transition"
                >
                  Ver
                </Link>
                {clienteTelefone && (
                  <a
                    href={whatsappLink(clienteTelefone, m.codigo, m.bairro)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white rounded-md transition hover:opacity-90"
                    style={{ backgroundColor: "#25D366" }}
                    title="Avisar pelo WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Avisar
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
