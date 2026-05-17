"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Clock, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatarMoeda, cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { PagamentoLocacao, StatusPagamento } from "@/types";

const STATUS_LABEL: Record<StatusPagamento, { label: string; class: string; icon: React.ReactNode }> = {
  pago: {
    label: "Pago",
    class: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: <Check className="w-3.5 h-3.5" />,
  },
  pendente: {
    label: "Pendente",
    class: "bg-slate-100 text-slate-600 ring-slate-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  atrasado: {
    label: "Atrasado",
    class: "bg-red-50 text-red-700 ring-red-200",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  parcial: {
    label: "Parcial",
    class: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

interface Props {
  contratoId: string;
  /** Valor default sugerido ao adicionar um novo pagamento (vem do contrato). */
  valorSugerido: number;
  /** Dia padrão de vencimento (vem do contrato). */
  diaVencimentoPadrao: number;
}

export function PagamentosLocacao({
  contratoId,
  valorSugerido,
  diaVencimentoPadrao,
}: Props) {
  const isAdmin = useAuthStore((s) => s.user?.perfil === "admin");
  const [pagamentos, setPagamentos] = useState<PagamentoLocacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [deletando, setDeletando] = useState<{ id: string; mes: string } | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PagamentoLocacao[]>(`/locacoes/${contratoId}/pagamentos`);
      setPagamentos(res.data);
    } catch {
      toast.error("Erro ao carregar pagamentos.");
    } finally {
      setLoading(false);
    }
  }, [contratoId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  async function handleAdicionarProximoMes() {
    setCriando(true);
    try {
      // Próximo mês ainda sem registro — começa pelo mês corrente.
      const ja = new Set(pagamentos.map((p) => p.mes_referencia));
      const hoje = new Date();
      let candidato = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      while (ja.has(candidato.toISOString().slice(0, 10))) {
        candidato = new Date(candidato.getFullYear(), candidato.getMonth() + 1, 1);
      }
      const mesRef = candidato.toISOString().slice(0, 10);
      const dia = Math.min(diaVencimentoPadrao, ultimoDiaDoMes(candidato));
      const vencimento = new Date(candidato.getFullYear(), candidato.getMonth(), dia)
        .toISOString()
        .slice(0, 10);

      await api.post(`/locacoes/${contratoId}/pagamentos`, {
        mes_referencia: mesRef,
        valor_devido: valorSugerido,
        data_vencimento: vencimento,
        status: "pendente",
      });
      toast.success("Pagamento gerado.");
      buscar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao criar pagamento.";
      toast.error(msg);
    } finally {
      setCriando(false);
    }
  }

  async function marcarStatus(p: PagamentoLocacao, novo: StatusPagamento) {
    try {
      await api.patch(`/locacoes/pagamentos/${p.id}`, {
        status: novo,
        valor_pago: novo === "pago" ? p.valor_devido : p.valor_pago,
      });
      buscar();
    } catch {
      toast.error("Erro ao atualizar pagamento.");
    }
  }

  async function handleDeletar() {
    if (!deletando) return;
    setDeletandoLoading(true);
    try {
      await api.delete(`/locacoes/pagamentos/${deletando.id}`);
      toast.success("Pagamento removido.");
      setDeletando(null);
      buscar();
    } catch {
      toast.error("Erro ao remover.");
    } finally {
      setDeletandoLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Pagamentos mensais</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Snapshot do valor devido no momento da geração.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleAdicionarProximoMes}
            disabled={criando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
            style={{ backgroundColor: "#585a4f" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {criando ? "Gerando..." : "Gerar próximo mês"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : pagamentos.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Nenhum pagamento registrado.
          {isAdmin && (
            <p className="text-xs mt-1">
              Clique em &quot;Gerar próximo mês&quot; para criar o primeiro.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mês</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Devido</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencimento</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagamentos.map((p) => {
                const disp = STATUS_LABEL[p.status];
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{mesLabel(p.mes_referencia)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                      {formatarMoeda(Number(p.valor_devido))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-600">
                      {p.valor_pago != null ? formatarMoeda(Number(p.valor_pago)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatarData(p.data_vencimento)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1",
                          disp.class
                        )}
                      >
                        {disp.icon}
                        {disp.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-1">
                          {p.status !== "pago" && (
                            <button
                              onClick={() => marcarStatus(p, "pago")}
                              className="px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded transition"
                              title="Marcar como pago"
                            >
                              Pago
                            </button>
                          )}
                          {p.status === "pago" && (
                            <button
                              onClick={() => marcarStatus(p, "pendente")}
                              className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition"
                              title="Reverter para pendente"
                            >
                              Reverter
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setDeletando({ id: p.id, mes: mesLabel(p.mes_referencia) })
                            }
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deletando}
        onOpenChange={(open) => {
          if (!open) setDeletando(null);
        }}
        title="Remover pagamento"
        description={`Remover o pagamento de ${deletando?.mes ?? ""}? Esta ação não pode ser desfeita.`}
        loading={deletandoLoading}
        onConfirm={handleDeletar}
      />
    </div>
  );
}

function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function ultimoDiaDoMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
