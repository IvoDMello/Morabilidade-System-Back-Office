"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

const schema = z.object({ email: z.string().email("E-mail inválido") });
type Form = z.infer<typeof schema>;

export default function RecuperarSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      await api.post("/auth/recuperar-senha", data);
      setEnviado(true);
    } catch {
      toast.error("Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Padrão decorativo */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: "#d8cb6a" }} />
        <div className="absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full opacity-[0.07]" style={{ backgroundColor: "#d8cb6a" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots2" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#d8cb6a" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots2)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Topo com logo */}
          <div className="flex items-center justify-center py-6 px-8" style={{ backgroundColor: "#585a4f" }}>
            <Image src="/logo.jpeg" alt="Morabilidade" width={160} height={44} className="object-contain" priority />
          </div>

          <div className="p-8">
            {enviado ? (
              <div className="text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 mb-2">E-mail enviado!</h2>
                <p className="text-slate-500 text-sm mb-6">
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: "#585a4f" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Recuperar senha</h2>
                <p className="text-slate-500 text-sm mb-6">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="seu@email.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                      style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                    style={{ backgroundColor: "#585a4f" }}
                  >
                    {loading ? "Enviando..." : "Enviar link"}
                  </button>

                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
                  >
                    <ArrowLeft className="w-3 h-3" /> Voltar ao login
                  </Link>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
