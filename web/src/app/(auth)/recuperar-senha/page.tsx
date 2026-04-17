"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "sonner";
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
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Recuperar senha</h1>
      <p className="text-slate-500 text-sm mb-6">
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      {enviado ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">E-mail enviado com sucesso!</p>
          <p className="text-slate-500 text-sm mt-2">Verifique sua caixa de entrada.</p>
          <Link href="/login" className="mt-4 inline-block text-primary text-sm hover:underline">
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input
              {...register("email")}
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.email && (
              <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Enviando..." : "Enviar link"}
          </button>
          <Link href="/login" className="block text-center text-xs text-slate-500 hover:underline">
            Voltar ao login
          </Link>
        </form>
      )}
    </div>
  );
}
