"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel visual (esquerda) — 60% olive + 30% dourado */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 text-secondary-foreground lg:flex"
        style={{
          backgroundImage:
            "linear-gradient(180deg, hsl(var(--secondary) / 0.55) 0%, hsl(var(--secondary) / 0.25) 42%, hsl(var(--secondary) / 0.82) 100%), url('/login-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Morabilidade"
            width={240}
            height={96}
            priority
            className="h-14 w-auto"
          />
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Gestão de captações de imóveis
          </h2>
          <p className="mt-3 text-secondary-foreground/80">
            Acompanhe cada captação do recebimento à decisão e ao agendamento de visita e
            gravação — tudo em um quadro só.
          </p>
        </div>

        <div className="flex gap-2">
          <span className="h-1.5 w-10 rounded-full bg-primary" />
          <span className="h-1.5 w-3 rounded-full bg-secondary-foreground/30" />
          <span className="h-1.5 w-3 rounded-full bg-secondary-foreground/30" />
        </div>
      </aside>

      {/* Formulário (direita no desktop; tela cheia no mobile) */}
      <div className="relative flex items-center justify-center bg-background p-6">
        {/* No mobile o painel da esquerda fica oculto, então a foto vai aqui como fundo. */}
        <div
          className="absolute inset-0 bg-cover bg-center lg:hidden"
          style={{
            backgroundImage:
              "linear-gradient(180deg, hsl(var(--secondary) / 0.62), hsl(var(--secondary) / 0.92)), url('/login-hero.jpg')",
          }}
          aria-hidden
        />

        <div className="relative w-full max-w-sm rounded-2xl bg-background/95 p-6 shadow-xl backdrop-blur-sm lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Image
              src="/icon.png"
              alt="Morabilidade"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg"
            />
            <span className="text-lg font-semibold">Morabilidade</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com seu acesso do Morabilidade.
          </p>

          <form onSubmit={entrar} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@morabilidade.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Acesso restrito à equipe Morabilidade.
          </p>
        </div>
      </div>
    </main>
  );
}
