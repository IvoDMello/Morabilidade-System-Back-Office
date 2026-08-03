"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, MapPin } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Login por e-mail/senha via Supabase Auth (mesmos usuários do projeto
 * principal — quem já entra nas captações entra aqui). Layout split-screen
 * seguindo o design_handoff_login_central_atendimento, alinhado ao padrão de
 * login do Painel Administrativo e da Gestão de Captações.
 *
 * O `ConditionalShell` já remove o chrome do app nesta rota, então a tela é
 * naturalmente full-bleed. Usa `100dvh` (não `100vh`) para respeitar a barra
 * dinâmica do navegador mobile e não gerar rolagem fantasma.
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
    // Entra direto nas conversas — é o que a equipe abre para trabalhar; a
    // visão geral é consulta, não ponto de partida.
    window.location.assign("/");
  }

  return (
    <div className="flex min-h-[100dvh] bg-white text-[#1F2320] lg:h-[100dvh] lg:overflow-hidden">
      {/* ── Painel esquerdo: foto + branding (desktop ≥1024px) ── */}
      <div className="relative hidden flex-col overflow-hidden bg-[#3C4A4F] lg:flex lg:w-[52%]">
        <Image
          src="/login-hero.jpg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,26,24,0.55) 0%, rgba(20,26,24,0.18) 38%, rgba(20,26,24,0.72) 100%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-between px-16 py-14">
          <Image
            src="/logo.png"
            alt="Morabilidade"
            width={190}
            height={50}
            className="h-auto w-[190px] object-contain"
            priority
          />

          <div className="flex max-w-[520px] flex-col gap-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#CBB26A]">
              Central de Atendimento
            </p>
            <h1 className="text-[52px] font-extrabold leading-[1.06] tracking-[-0.02em] text-white">
              Toda conversa<br />em um só lugar.
            </h1>
            <p className="max-w-[400px] text-[17px] leading-relaxed text-white/[0.78]">
              Atenda proprietários, inquilinos e corretores pelos canais da
              Morabilidade, com histórico completo de cada contato.
            </p>
          </div>

          <div className="flex items-center justify-between text-[13px] text-white/60">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Zona Sul · Rio de Janeiro, RJ
            </span>
            <span>© 2026 Morabilidade</span>
          </div>
        </div>
      </div>

      {/* ── Painel direito: formulário ── */}
      <div className="relative flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:overflow-y-auto">
        {/* Hero mobile (foto + logo sobreposta), só fora do desktop */}
        <div className="relative h-[358px] w-full flex-shrink-0 overflow-hidden lg:hidden">
          <Image
            src="/login-hero.jpg"
            alt="Zona Sul do Rio de Janeiro"
            fill
            className="object-cover object-center"
            priority
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,26,24,0.55) 0%, rgba(20,26,24,0.25) 45%, rgba(20,26,24,0.80) 100%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-start gap-4 px-[26px] py-11">
            <Image
              src="/logo.png"
              alt="Morabilidade"
              width={140}
              height={38}
              className="h-auto w-[140px] object-contain drop-shadow"
              priority
            />
            <div className="mt-auto flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#CBB26A]">
                Central de Atendimento
              </p>
              <h1 className="text-[30px] font-extrabold leading-[1.1] text-white">
                Toda conversa em um só lugar.
              </h1>
            </div>
          </div>
        </div>

        {/* Folha branca do formulário */}
        <div className="relative z-10 -mt-7 flex w-full flex-1 flex-col rounded-t-[24px] bg-white px-[26px] pb-7 pt-8 lg:mt-0 lg:max-w-[352px] lg:flex-none lg:rounded-none lg:px-0 lg:py-0">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold leading-tight tracking-[-0.015em] text-[#1F2320] lg:text-[28px]">
              Entrar no sistema
            </h2>
            <p className="text-[13.5px] leading-normal text-[#77786F] lg:text-sm">
              Acesso exclusivo para colaboradores
            </p>
          </div>

          <form onSubmit={entrar} className="mt-6 flex flex-col gap-[18px]">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[13px] font-semibold text-[#3F4139]">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-[50px] rounded-xl border border-[#E3E1DB] bg-white px-3.5 text-[15px] text-[#1F2320] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#A3A3A0] focus:border-[#CBB26A] focus:shadow-[0_0_0_3px_rgba(203,178,106,0.22)] lg:h-[46px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="senha" className="text-[13px] font-semibold text-[#3F4139]">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="h-[50px] w-full rounded-xl border border-[#E3E1DB] bg-white px-3.5 pr-12 text-[15px] text-[#1F2320] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#A3A3A0] focus:border-[#CBB26A] focus:shadow-[0_0_0_3px_rgba(203,178,106,0.22)] lg:h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-[7px] top-[7px] flex h-9 w-9 items-center justify-center rounded-lg text-[#8B8C82] transition-colors hover:bg-[#F2F1EC] hover:text-[#55584A] lg:right-1.5 lg:top-1.5 lg:h-[34px] lg:w-[34px]"
                >
                  {showPassword ? (
                    <EyeOff className="h-[19px] w-[19px]" />
                  ) : (
                    <Eye className="h-[19px] w-[19px]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-[52px] rounded-xl bg-[#55584A] text-[15px] font-bold text-white transition-colors duration-150 hover:bg-[#42453A] disabled:pointer-events-none disabled:opacity-70 lg:h-12 lg:rounded-[10px]"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={recuperarSenha}
              className="mx-auto mt-1 text-sm font-medium text-[#6C6D64] transition-colors hover:text-[#55584A] hover:underline"
            >
              Esqueci minha senha
            </button>
          </form>

          <p className="mt-auto pt-8 text-center text-xs text-[#A3A49B] lg:hidden">
            © 2026 Morabilidade · Zona Sul, Rio de Janeiro
          </p>
        </div>
      </div>
    </div>
  );
}
