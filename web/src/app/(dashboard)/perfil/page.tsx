"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "disabled:bg-slate-50 disabled:text-slate-400";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="pb-2 mb-5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function PerfilPage() {
  const { user, setUser } = useAuthStore();

  const [nome, setNome] = useState(user?.nome_completo ?? "");
  const [telefone, setTelefone] = useState(user?.telefone ?? "");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Nome é obrigatório."); return; }
    setSalvandoPerfil(true);
    try {
      const res = await api.put("/usuarios/me", { nome_completo: nome.trim(), telefone: telefone || null });
      setUser(res.data);
      toast.success("Perfil atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar perfil.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) { toast.error("A nova senha deve ter no mínimo 8 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { toast.error("As senhas não coincidem."); return; }
    setSalvandoSenha(true);
    try {
      await api.put("/usuarios/me/senha", { senha_atual: senhaAtual, nova_senha: novaSenha });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso!");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao alterar senha.";
      toast.error(msg);
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + info */}
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ backgroundColor: "#d8cb6a", color: "#585a4f" }}
        >
          {user?.foto_url ? (
            <img src={user.foto_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            user?.nome_completo?.[0]?.toUpperCase() ?? <User className="w-6 h-6" />
          )}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{user?.nome_completo}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.perfil}</p>
        </div>
      </div>

      {/* Dados do perfil */}
      <SectionCard title="Dados do perfil">
        <form onSubmit={salvarPerfil} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
                placeholder="Seu nome completo"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
              <input
                value={user?.email ?? ""}
                disabled
                className={inputClass}
                title="O e-mail não pode ser alterado"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className={inputClass}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={salvandoPerfil}
              className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "#585a4f" }}
            >
              {salvandoPerfil && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar perfil
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Troca de senha */}
      <SectionCard title="Alterar senha">
        <form onSubmit={trocarSenha} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Senha atual *</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nova senha *</label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className={inputClass}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirmar nova senha *</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className={inputClass}
                placeholder="Repita a nova senha"
                required
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={salvandoSenha}
              className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "#585a4f" }}
            >
              {salvandoSenha && <Loader2 className="w-4 h-4 animate-spin" />}
              Alterar senha
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
