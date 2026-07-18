"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setLoading(false);
      toast.error("E-mail ou senha inválidos.");
      return;
    }
    // Recarga real (não navegação interna): garante que o cookie de sessão
    // recém-gravado seja enviado ao middleware na 1ª tentativa.
    window.location.assign("/board");
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Painel esquerdo: foto + branding (desktop) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        <Image
          src="/login-hero.jpg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom right, rgba(88,90,79,0.80) 0%, rgba(88,90,79,0.55) 60%, rgba(30,30,20,0.70) 100%)",
          }}
        />

        <div className="relative flex flex-col h-full p-12 justify-between">
          <div>
            <Image
              src="/logo.png"
              alt="Morabilidade"
              width={180}
              height={48}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <div>
            <p className="text-[#d8cb6a] text-sm font-semibold tracking-widest uppercase mb-3">
              Gestão de Captações
            </p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Do recebimento<br />à decisão.
            </h1>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Acompanhe cada captação, recebimento, decisão, visita e gravação, em um
              quadro só.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <MapPin className="w-3.5 h-3.5" />
              Zona Sul · Rio de Janeiro, RJ
            </div>
            <p className="text-white/30 text-xs">© 2025 Morabilidade</p>
          </div>
        </div>
      </div>

      {/* ── Painel direito: formulário ── */}
      <div className="flex-1 flex flex-col lg:items-center lg:justify-center bg-white">
        {/* Hero mobile (foto + logo sobreposta), só fora do desktop */}
        <div className="lg:hidden relative w-full h-56 sm:h-72 flex-shrink-0">
          <Image
            src="/login-hero.jpg"
            alt="Zona Sul do Rio de Janeiro"
            fill
            className="object-cover object-center"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(88,90,79,0.55) 0%, rgba(88,90,79,0.75) 60%, rgba(30,30,20,0.92) 100%)",
            }}
          />
          <div className="relative h-full flex flex-col items-center justify-end px-6 pb-6 gap-2">
            <Image
              src="/logo.png"
              alt="Morabilidade"
              width={160}
              height={44}
              className="h-11 w-auto object-contain drop-shadow"
              priority
            />
            <p className="text-[#d8cb6a] text-[11px] font-semibold tracking-widest uppercase">
              Gestão de Captações
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto px-6 py-8 lg:py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Entrar no sistema</h2>
            <p className="text-slate-500 text-sm mt-1">Acesso exclusivo para colaboradores</p>
          </div>

          <form onSubmit={entrar} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
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
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Esqueci minha senha
            </button>
          </form>

          <p className="lg:hidden mt-8 text-center text-xs text-slate-400">
            Zona Sul · Rio de Janeiro · © 2025 Morabilidade
          </p>
        </div>
      </div>
    </div>
  );
}
