"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Preferencia {
  id?: string;
  cliente_id?: string;
  tipo_negocio?: string | null;
  tipo_imovel?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  dormitorios_min?: number | null;
  observacoes?: string | null;
  ativa?: boolean;
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f]";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

interface Props {
  clienteId: string;
  onSaved?: () => void;
}

export function PreferenciaForm({ clienteId, onSaved }: Props) {
  const isAdmin = useAuthStore((s) => s.user?.perfil === "admin");
  const [pref, setPref] = useState<Preferencia>({ ativa: true });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [existe, setExiste] = useState(false);

  useEffect(() => {
    api
      .get<Preferencia>(`/clientes/${clienteId}/preferencia`)
      .then((r) => {
        setPref(r.data);
        setExiste(true);
      })
      .catch(() => {
        // 404 = sem preferência ainda — começa em branco
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        ...pref,
        // Selects: undefined/empty → null para garantir que o banco limpa o campo
        tipo_negocio: pref.tipo_negocio || null,
        tipo_imovel: pref.tipo_imovel || null,
        // Textos: string vazia → null para manter o banco limpo
        cidade: pref.cidade?.trim() || null,
        bairro: pref.bairro?.trim() || null,
        observacoes: pref.observacoes?.trim() || null,
        // Números: string vazia ou null → null
        valor_min: pref.valor_min === ("" as unknown) || pref.valor_min == null ? null : Number(pref.valor_min),
        valor_max: pref.valor_max === ("" as unknown) || pref.valor_max == null ? null : Number(pref.valor_max),
        dormitorios_min:
          pref.dormitorios_min === ("" as unknown) || pref.dormitorios_min == null
            ? null
            : Number(pref.dormitorios_min),
      };
      const res = await api.put<Preferencia>(`/clientes/${clienteId}/preferencia`, payload);
      setPref(res.data);
      setExiste(true);
      toast.success("Preferência salva.");
      onSaved?.();
    } catch {
      toast.error("Erro ao salvar preferência.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!confirm("Remover a preferência deste cliente?")) return;
    try {
      await api.delete(`/clientes/${clienteId}/preferencia`);
      setPref({ ativa: true });
      setExiste(false);
      toast.success("Preferência removida.");
    } catch {
      toast.error("Erro ao remover preferência.");
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Carregando preferências…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Tipo de negócio</label>
          <select
            value={pref.tipo_negocio ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, tipo_negocio: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">— Qualquer —</option>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Tipo de imóvel</label>
          <select
            value={pref.tipo_imovel ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, tipo_imovel: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">— Qualquer —</option>
            <option value="apartamento">Apartamento</option>
            <option value="cobertura">Cobertura</option>
            <option value="casa">Casa</option>
            <option value="kitnet">Kitnet</option>
            <option value="terreno">Terreno</option>
            <option value="sala">Sala comercial</option>
            <option value="loja">Loja</option>
            <option value="galpao">Galpão</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Cidade</label>
          <input
            value={pref.cidade ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, cidade: e.target.value }))}
            className={inputClass}
            placeholder="Ex: Rio de Janeiro"
          />
        </div>
        <div>
          <label className={labelClass}>Bairro</label>
          <input
            value={pref.bairro ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, bairro: e.target.value }))}
            className={inputClass}
            placeholder="Ex: Leblon, Ipanema"
          />
        </div>

        <div>
          <label className={labelClass}>Valor mínimo (R$)</label>
          <input
            type="number"
            min={0}
            value={pref.valor_min ?? ""}
            disabled={!isAdmin}
            onChange={(e) =>
              setPref((p) => ({ ...p, valor_min: e.target.value === "" ? null : Number(e.target.value) }))
            }
            className={inputClass}
            placeholder="Ex: 1500000"
          />
        </div>
        <div>
          <label className={labelClass}>Valor máximo (R$)</label>
          <input
            type="number"
            min={0}
            value={pref.valor_max ?? ""}
            disabled={!isAdmin}
            onChange={(e) =>
              setPref((p) => ({ ...p, valor_max: e.target.value === "" ? null : Number(e.target.value) }))
            }
            className={inputClass}
            placeholder="Ex: 3000000"
          />
        </div>

        <div>
          <label className={labelClass}>Dormitórios mínimos</label>
          <input
            type="number"
            min={0}
            value={pref.dormitorios_min ?? ""}
            disabled={!isAdmin}
            onChange={(e) =>
              setPref((p) => ({
                ...p,
                dormitorios_min: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            className={inputClass}
            placeholder="Ex: 3"
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={pref.ativa ? "true" : "false"}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, ativa: e.target.value === "true" }))}
            className={inputClass}
          >
            <option value="true">Ativa (gerar matches)</option>
            <option value="false">Pausada</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Observações</label>
          <textarea
            value={pref.observacoes ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setPref((p) => ({ ...p, observacoes: e.target.value }))}
            rows={2}
            className={inputClass + " resize-none"}
            placeholder="Notas livres sobre o que o cliente busca..."
          />
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          {existe && (
            <button
              type="button"
              onClick={remover}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover preferência
            </button>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#585a4f" }}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {existe ? "Atualizar" : "Salvar preferência"}
          </button>
        </div>
      )}
    </div>
  );
}
