"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, MapPin } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, senha: data.senha }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Usa a mensagem do servidor quando disponível — distingue
        // "credenciais incorretas" de "API fora do ar", "perfil ausente", etc.
        const detail =
          typeof json === "object" && json && "detail" in json && json.detail
            ? String(json.detail)
            : "E-mail ou senha incorretos.";
        toast.error(detail);
        return;
      }

      setUser(json.user);
      if (json.access_token) setToken(json.access_token);
      router.push("/");
    } catch (err) {
      console.error("[login] erro inesperado:", err);
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Painel esquerdo: foto + branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        {/* Foto de fundo */}
        <Image
          src="/login-bg.jpeg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Overlay escuro com gradiente */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom right, rgba(88,90,79,0.80) 0%, rgba(88,90,79,0.55) 60%, rgba(30,30,20,0.70) 100%)",
          }}
        />

        {/* Conteúdo sobre a foto */}
        <div className="relative flex flex-col h-full p-12 justify-between">
          {/* Logo */}
          <div>
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={180}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          {/* Tagline central */}
          <div>
            <p className="text-[#d8cb6a] text-sm font-semibold tracking-widest uppercase mb-3">
              Painel Administrativo
            </p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Simples,<br />Eficiente e<br />Humanizada.
            </h1>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Gerencie seu portfólio imobiliário com agilidade e controle total — em qualquer dispositivo.
            </p>
          </div>

          {/* Rodapé */}
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
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile (aparece só em telas pequenas) */}
          <div className="lg:hidden mb-10 flex flex-col items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={160}
              height={44}
              className="object-contain"
              priority
            />
            <p className="text-slate-500 text-sm text-center">Simples, Eficiente e Humanizada</p>
          </div>

          {/* Título */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Entrar no sistema</h2>
            <p className="text-slate-500 text-sm mt-1">Acesso exclusivo para colaboradores</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                {...register("email")}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  {...register("senha")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {errors.senha && (
                <p className="text-red-500 text-xs mt-1.5">{errors.senha.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link
                href="/recuperar-senha"
                className="text-xs text-slate-500 hover:text-slate-700 hover:underline transition"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
              style={{ backgroundColor: "#585a4f" }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {/* Rodapé mobile */}
          <p className="lg:hidden mt-8 text-center text-xs text-slate-400">
            Zona Sul · Rio de Janeiro · © 2025 Morabilidade
          </p>
        </div>
      </div>
    </div>
  );
}
