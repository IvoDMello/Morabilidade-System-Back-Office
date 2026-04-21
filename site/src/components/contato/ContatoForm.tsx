"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { enviarContato } from "@/lib/api";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-slate-400";

interface Props {
  codigoImovel?: string;
}

export function ContatoForm({ codigoImovel }: Props) {
  const mensagemInicial = codigoImovel
    ? `Olá! Tenho interesse no imóvel de código ${codigoImovel}. Pode me dar mais informações?`
    : "";

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    mensagem: mensagemInicial,
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.mensagem) {
      toast.error("Preencha nome, e-mail e mensagem.");
      return;
    }
    setEnviando(true);
    try {
      await enviarContato(form);
      setEnviado(true);
      toast.success("Mensagem enviada! Entraremos em contato em breve.");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: "#d8cb6a" }}
        >
          ✓
        </div>
        <h3 className="text-xl font-semibold text-slate-800">Mensagem enviada!</h3>
        <p className="text-slate-500 max-w-sm">
          Recebemos sua mensagem e entraremos em contato o mais breve possível.
        </p>
        <button
          onClick={() => { setEnviado(false); setForm({ nome: "", email: "", telefone: "", mensagem: "" }); }}
          className="mt-2 text-sm underline text-slate-400 hover:text-slate-600 transition"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
          <input
            value={form.nome}
            onChange={set("nome")}
            className={inputClass}
            placeholder="Seu nome"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">E-mail *</label>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            className={inputClass}
            placeholder="seu@email.com"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
        <input
          value={form.telefone}
          onChange={set("telefone")}
          className={inputClass}
          placeholder="(00) 00000-0000"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem *</label>
        <textarea
          value={form.mensagem}
          onChange={set("mensagem")}
          rows={5}
          className={inputClass + " resize-none"}
          placeholder="Como podemos te ajudar?"
          required
        />
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#585a4f" }}
      >
        {enviando ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {enviando ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}
