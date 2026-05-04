"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { whatsappLink } from "@/lib/whatsapp";

interface Interessado {
  cliente_id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  tipo_cliente?: string;
  preferencia_id: string;
  observacoes_preferencia?: string;
  score: number;
}

interface Props {
  imovelId: string;
  imovelCodigo: string;
  imovelBairro: string;
  imovelCidade?: string;
  imovelTipoImovel?: string;
  imovelTipoNegocio?: string;
  imovelDormitorios?: number;
  imovelValorVenda?: number;
  imovelValorLocacao?: number;
}

const SCORE_MAX = 7;

function ScoreDots({ score }: { score: number }) {
  return (
    <span
      className="flex items-center gap-0.5 flex-shrink-0"
      title={`${score} de ${SCORE_MAX} critérios de busca definidos`}
    >
      {Array.from({ length: SCORE_MAX }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < score ? "bg-amber-400" : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}

export function InteressadosImovel({
  imovelId, imovelCodigo, imovelBairro, imovelCidade,
  imovelTipoImovel, imovelTipoNegocio, imovelDormitorios,
  imovelValorVenda, imovelValorLocacao,
}: Props) {
  const [lista, setLista] = useState<Interessado[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Interessado[]>(`/imoveis/${imovelId}/interessados`)
      .then((r) => setLista(r.data))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [imovelId]);

  if (loading) {
    return <p className="text-xs text-slate-400">Buscando clientes interessados…</p>;
  }

  if (!lista || lista.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nenhum cliente cadastrado tem preferência ativa que case com este imóvel.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Banner de notificação */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-200">
        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-sm font-medium text-amber-800">
          {lista.length} cliente{lista.length !== 1 ? "s" : ""} com preferência ativa compatível com este imóvel
        </p>
      </div>

      <div className="space-y-2">
        {lista.map((c) => (
          <div
            key={c.cliente_id}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-800">{c.nome_completo}</p>
                <ScoreDots score={c.score} />
              </div>
              <p className="text-xs text-slate-500">
                {c.telefone}
                {c.email ? ` · ${c.email}` : ""}
              </p>
              {c.observacoes_preferencia && (
                <p className="text-xs text-slate-400 mt-1 italic">
                  &quot;{c.observacoes_preferencia}&quot;
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Link
                href={`/clientes/${c.cliente_id}`}
                className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-[#585a4f] hover:bg-white rounded-md transition"
              >
                Ver cliente
              </Link>
              {c.telefone && (
                <a
                  href={whatsappLink(c.telefone, {
                    codigo: imovelCodigo,
                    bairro: imovelBairro,
                    cidade: imovelCidade,
                    tipo_imovel: imovelTipoImovel,
                    tipo_negocio: imovelTipoNegocio,
                    dormitorios: imovelDormitorios,
                    valor_venda: imovelValorVenda,
                    valor_locacao: imovelValorLocacao,
                  })}
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
        ))}
      </div>
    </div>
  );
}
