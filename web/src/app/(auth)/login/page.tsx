"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", data);
      setToken(res.data.access_token);
      const meRes = await api.get("/usuarios/me", {
        headers: { Authorization: `Bearer ${res.data.access_token}` },
      });
      setUser(meRes.data);
      router.push("/");
    } catch {
      toast.error("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full">
      {/* Topo com fundo olive e logo */}
      <div className="flex items-center justify-center py-8 px-8" style={{ backgroundColor: "#585a4f" }}>
        <Image
          src="/logo.jpeg"
          alt="Morabilidade"
          width={200}
          height={54}
          className="object-contain"
          priority
        />
      </div>

      {/* Formulário */}
      <div className="p-8">
        <p className="text-slate-500 text-sm text-center mb-6">Sistema de Gestão Imobiliária</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              {...register("email")}
              type="email"
              placeholder="seu@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#d8cb6a" } as React.CSSProperties}
            />
            {errors.email && (
              <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input
              {...register("senha")}
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
            {errors.senha && (
              <p className="text-destructive text-xs mt-1">{errors.senha.message}</p>
            )}
          </div>

          <div className="text-right">
            <Link href="/recuperar-senha" className="text-xs hover:underline" style={{ color: "#585a4f" }}>
              Esqueceu a senha?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
            style={{ backgroundColor: "#d8cb6a", color: "#585a4f" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
