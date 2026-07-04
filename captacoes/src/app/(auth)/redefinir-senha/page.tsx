"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Destino do link "Esqueci minha senha". O cliente Supabase troca o código da
 * URL por uma sessão de recuperação ao carregar; daí basta definir a nova senha.
 */
export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // O @supabase/ssr troca o ?code= por sessão automaticamente; aqui só
    // conferimos se deu certo para orientar quem chegou com link vencido.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setSessaoOk(!!data.session);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  async function redefinir(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível redefinir. Peça um novo link de recuperação.");
      return;
    }
    toast.success("Senha redefinida.");
    window.location.assign("/board");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f0] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#e6e7e1] bg-white p-8 shadow-sm">
        <Image src="/icon.png" alt="Morabilidade" width={40} height={40} className="h-10 w-10 rounded-md" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Redefinir senha</h1>

        {sessaoOk === false ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-500">
              Este link de recuperação expirou ou já foi usado. Volte ao login e peça um novo em
              &ldquo;Esqueci minha senha&rdquo;.
            </p>
            <a
              href="/login"
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Voltar ao login
            </a>
          </div>
        ) : (
          <form onSubmit={redefinir} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Nova senha</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 transition focus:border-transparent focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirmar senha</label>
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 transition focus:border-transparent focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
              />
            </div>

            <button
              type="submit"
              disabled={loading || sessaoOk === null}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#585a4f" }}
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
