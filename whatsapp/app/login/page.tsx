"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Login por e-mail/senha via Supabase Auth (mesmos usuários do projeto
 * principal — quem já entra nas captações entra aqui). Padrão portado de
 * captacoes/src/app/(auth)/login, com visual simplificado para o CRM.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function recuperarSenha() {
    if (!email.trim()) {
      toast.error("Informe seu e-mail acima para recuperar a senha.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast.error("Não foi possível enviar o e-mail de recuperação.");
      return;
    }
    toast.success("Enviamos um link de redefinição para o seu e-mail.");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setLoading(false);
      toast.error("E-mail ou senha inválidos.");
      return;
    }
    // Recarga real (não navegação interna): garante que o cookie de sessão
    // recém-gravado seja enviado ao middleware na 1ª tentativa.
    window.location.assign("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: "#585a4f" }}
          >
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Central de Atendimento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Morabilidade · acesso exclusivo para colaboradores
          </p>
        </div>

        <form onSubmit={entrar} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#585a4f] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#585a4f] focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
            style={{ backgroundColor: "#585a4f" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={recuperarSenha}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
          >
            Esqueci minha senha
          </button>
        </form>
      </div>
    </div>
  );
}
