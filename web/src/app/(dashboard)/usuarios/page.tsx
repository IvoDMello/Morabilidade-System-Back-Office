"use client";

import { useEffect, useState } from "react";
import { Plus, X, Loader2, UserCheck, UserX, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { User as UserType } from "@/types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const selectClass = inputClass;
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

interface NovoUsuarioForm {
  nome_completo: string;
  email: string;
  senha: string;
  perfil: "admin" | "administrativo";
  telefone: string;
}

export default function UsuariosPage() {
  const { user: me } = useAuthStore();
  const [usuarios, setUsuarios] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desativandoId, setDesativandoId] = useState<string | null>(null);

  const [form, setForm] = useState<NovoUsuarioForm>({
    nome_completo: "",
    email: "",
    senha: "",
    perfil: "administrativo",
    telefone: "",
  });

  const isAdmin = me?.perfil === "admin";

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get<UserType[]>("/usuarios/");
      setUsuarios(res.data);
    } catch {
      toast.error("Sem permissão ou erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function resetForm() {
    setForm({ nome_completo: "", email: "", senha: "", perfil: "administrativo", telefone: "" });
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome_completo || !form.email || !form.senha) {
      toast.error("Preencha nome, e-mail e senha.");
      return;
    }
    if (form.senha.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/usuarios/", {
        ...form,
        telefone: form.telefone || null,
      });
      toast.success("Usuário criado com sucesso!");
      setCriando(false);
      resetForm();
      await carregar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao criar usuário.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function desativarUsuario(id: string, nome: string) {
    if (!confirm(`Desativar o usuário "${nome}"? Ele não poderá mais fazer login.`)) return;
    setDesativandoId(id);
    try {
      await api.delete(`/usuarios/${id}`);
      toast.success("Usuário desativado.");
      await carregar();
    } catch {
      toast.error("Erro ao desativar usuário.");
    } finally {
      setDesativandoId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-slate-500 text-sm">Gestão de usuários internos — somente Admin</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Novo usuário
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {criando && isAdmin && (
        <form
          onSubmit={criarUsuario}
          className="bg-white rounded-xl border border-blue-200 p-6 mb-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Novo usuário interno</h3>
            <button
              type="button"
              onClick={() => { setCriando(false); resetForm(); }}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Nome completo *</label>
              <input
                value={form.nome_completo}
                onChange={(e) => setForm((f) => ({ ...f, nome_completo: e.target.value }))}
                className={inputClass}
                placeholder="Nome completo"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Perfil de acesso *</label>
              <select
                value={form.perfil}
                onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value as "admin" | "administrativo" }))}
                className={selectClass}
              >
                <option value="administrativo">Administrativo</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>E-mail *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
                placeholder="email@exemplo.com"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Senha * (mín. 8 caracteres)</label>
              <input
                type="password"
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                className={inputClass}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                className={inputClass}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar usuário
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Carregando usuários...
            </div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Perfil</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usuarios.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition ${!u.ativo ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.foto_url ? (
                          <img src={u.foto_url} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-800">{u.nome_completo}</p>
                          {u.id === me?.id && (
                            <span className="text-xs text-blue-500 font-medium">Você</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{u.email}</p>
                      {u.telefone && <p className="text-xs text-slate-400">{u.telefone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.perfil === "admin" ? (
                          <Shield className="w-3.5 h-3.5 text-violet-500" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span className={u.perfil === "admin" ? "text-violet-700 font-medium" : "text-slate-600"}>
                          {u.perfil === "admin" ? "Admin" : "Administrativo"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.ativo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                          <UserCheck className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                          <UserX className="w-3 h-3" /> Inativo
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {u.ativo && u.id !== me?.id && (
                          <button
                            onClick={() => desativarUsuario(u.id, u.nome_completo)}
                            disabled={desativandoId === u.id}
                            className="text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition disabled:opacity-40"
                          >
                            {desativandoId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Desativar"
                            )}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
