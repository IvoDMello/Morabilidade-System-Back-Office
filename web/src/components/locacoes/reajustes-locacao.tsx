"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatarMoeda } from "@/lib/utils";
import type { ReajusteLocacao } from "@/types";

interface Props {
  contratoId: string;
  aluguelAtual: number;
  /** Chamado depois de aplicar reajuste, útil para recarregar o contrato pai. */
  onAplicado?: () => void;
}

export function ReajustesLocacao({ contratoId, aluguelAtual, onAplicado }: Props) {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));

  const [reajustes, setReajustes] = useState<ReajusteLocacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);

  // form
  const [dataAplicacao, setDataAplicacao] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [percentual, setPercentual] = useState("");
  const [indice, setIndice] = useState("IGPM");
  const [observacoes, setObservacoes] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ReajusteLocacao[]>(`/locacoes/${contratoId}/reajustes`);
      setReajustes(res.data);
    } catch {
      toast.error("Erro ao carregar histórico de reajustes.");
    } finally {
      setLoading(false);
    }
  }, [contratoId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const pct = Number(percentual) || 0;
  const novoAluguel = aluguelAtual * (1 + pct / 100);

  async function handleAplicar() {
    if (!percentual) {
      toast.error("Informe o percentual.");
      return;
    }
    setAplicando(true);
    try {
      await api.post(`/locacoes/${contratoId}/reajustar`, {
        data_aplicacao: dataAplicacao,
        percentual: Number(percentual),
        indice_referencia: indice || null,
        observacoes: observacoes || null,
      });
      toast.success("Reajuste aplicado.");
      setAberto(false);
      setPercentual("");
      setObservacoes("");
      buscar();
      onAplicado?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao aplicar reajuste.";
      toast.error(msg);
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Reajustes do aluguel
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Aluguel atual: <strong>{formatarMoeda(aluguelAtual)}</strong>.
            Pagamentos já gerados não são alterados retroativamente.
          </p>
        </div>
        {isAdmin && !aberto && (
          <button
            onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition"
            style={{ backgroundColor: "#585a4f" }}
          >
            <Plus className="w-3.5 h-3.5" /> Aplicar reajuste
          </button>
        )}
      </div>

      {aberto && isAdmin && (
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data
              </label>
              <input
                type="date"
                value={dataAplicacao}
                onChange={(e) => setDataAplicacao(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Percentual (%)
              </label>
              <input
                type="number"
                step="0.001"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                placeholder="Ex: 4.25"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Índice
              </label>
              <select
                value={indice}
                onChange={(e) => setIndice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="IGPM">IGPM</option>
                <option value="IPCA">IPCA</option>
                <option value="INCC">INCC</option>
                <option value="">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Novo aluguel (preview)
              </label>
              <div
                className="px-3 py-2 text-sm rounded-lg font-semibold"
                style={{ backgroundColor: "#fdfaef", color: "#585a4f" }}
              >
                {formatarMoeda(novoAluguel)}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Observações
              </label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Negociado por telefone com a proprietária"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setAberto(false)}
              disabled={aplicando}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleAplicar}
              disabled={aplicando || !percentual}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
              style={{ backgroundColor: "#585a4f" }}
            >
              {aplicando && <Loader2 className="w-4 h-4 animate-spin" />}
              Aplicar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : reajustes.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          Nenhum reajuste aplicado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Índice</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Percentual</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">De</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Para</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reajustes.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-2.5 text-slate-700">{formatarData(r.data_aplicacao)}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs uppercase tracking-wider">
                    {r.indice_referencia ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {Number(r.percentual) > 0 ? "+" : ""}
                    {Number(r.percentual).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">
                    {formatarMoeda(Number(r.aluguel_anterior))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-800">
                    {formatarMoeda(Number(r.aluguel_novo))}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate" title={r.observacoes ?? ""}>
                    {r.observacoes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}
