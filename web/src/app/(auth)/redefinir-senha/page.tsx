"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const schema = z
  .object({
    senha: z.string().min(8, "Mínimo 8 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    message: "As senhas não coincidem",
    path: ["confirmar"],
  });
type Form = z.infer<typeof schema>;

type Estado = "carregando" | "ok" | "invalido" | "concluido";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagemErro, setMensagemErro] = useState<string>("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  // Aguarda o supabase-js processar o token vindo no fragment da URL
  useEffect(() => {
    let cancelado = false;
    const supabase = getSupabaseBrowser();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (cancelado) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setEstado("ok");
      }
    });

    // Fallback: depois de 1.5s, checa se há sessão válida
    const timeout = setTimeout(async () => {
      if (cancelado) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setEstado("ok");
      } else {
        setEstado("invalido");
        setMensagemErro(
          "Link inválido ou expirado. Solicite um novo e-mail de redefinição."
        );
      }
    }, 1500);

    return () => {
      cancelado = true;
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(data: Form) {
    setSalvando(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password: data.senha });
      if (error) throw new Error(error.message);

      // Encerra a sessão temporária criada pelo recovery — o usuário precisa
      // fazer login normalmente em seguida.
      await supabase.auth.signOut();

      setEstado("concluido");
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => router.push("/login"), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao redefinir senha.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Padrão decorativo */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: "#d8cb6a" }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full opacity-[0.07]"
          style={{ backgroundColor: "#d8cb6a" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div
            className="flex items-center justify-center py-6 px-8"
            style={{ backgroundColor: "#585a4f" }}
          >
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={160}
              height={44}
              className="object-contain"
              priority
            />
          </div>

          <div className="p-8">
            {estado === "carregando" && (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Loader2
                  className="w-6 h-6 animate-spin"
                  style={{ color: "#585a4f" }}
                />
                <p className="text-slate-500 text-sm">Validando link...</p>
              </div>
            )}

            {estado === "invalido" && (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-2xl">!</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Link inválido
                </h2>
                <p className="text-slate-500 text-sm mb-6">{mensagemErro}</p>
                <Link
                  href="/recuperar-senha"
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: "#585a4f" }}
                >
                  Solicitar novo link
                </Link>
              </div>
            )}

            {estado === "concluido" && (
              <div className="text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Senha redefinida!
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Você será redirecionado para o login...
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: "#585a4f" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Ir para login agora
                </Link>
              </div>
            )}

            {estado === "ok" && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  Redefinir senha
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Defina uma nova senha para sua conta. Mínimo de 8 caracteres.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        {...register("senha")}
                        type={mostrarSenha ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                        style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        tabIndex={-1}
                      >
                        {mostrarSenha ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.senha && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {errors.senha.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirmar nova senha
                    </label>
                    <input
                      {...register("confirmar")}
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                      style={{ "--tw-ring-color": "#585a4f" } as React.CSSProperties}
                    />
                    {errors.confirmar && (
                      <p className="text-red-500 text-xs mt-1.5">
                        {errors.confirmar.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                    style={{ backgroundColor: "#585a4f" }}
                  >
                    {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                    {salvando ? "Salvando..." : "Salvar nova senha"}
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
