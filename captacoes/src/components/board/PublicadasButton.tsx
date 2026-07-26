"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowUpRight, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { dataCurta, relativo } from "@/lib/format";

interface Publicada {
  id: string;
  endereco: string;
  bairro: string | null;
  imovel_codigo: string | null;
  publicada_em: string | null;
}

type Periodo = "todas" | "mes" | "30d";

const PERIODO_LABEL: Record<Periodo, string> = {
  todas: "Todas",
  mes: "Este mês",
  "30d": "Últimos 30 dias",
};

/** Primeiro dia do mês corrente (00:00 local). */
function inicioDoMes(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Aba oculta: captações já gravadas e publicadas, consultáveis pela data. */
export function PublicadasButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<Publicada[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todas");

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("captacao")
      .select("id, endereco, bairro, imovel_codigo, publicada_em")
      .eq("status", "publicada")
      .is("excluido_em", null)
      .order("publicada_em", { ascending: false });
    setItens((data ?? []) as Publicada[]);
    setCarregando(false);
  }

  // Carrega uma vez no mount para o contador do mês aparecer no badge da trigger.
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noMes = useMemo(() => {
    const ini = inicioDoMes();
    return itens.filter((it) => it.publicada_em && new Date(it.publicada_em).getTime() >= ini).length;
  }, [itens]);

  const termo = busca.trim().toLowerCase();
  const filtradas = useMemo(() => {
    const limite = periodo === "mes" ? inicioDoMes() : periodo === "30d" ? Date.now() - 30 * 86400000 : null;
    return itens.filter((it) => {
      if (limite != null && !(it.publicada_em && new Date(it.publicada_em).getTime() >= limite)) return false;
      if (!termo) return true;
      return [it.endereco, it.bairro, it.imovel_codigo].filter(Boolean).some((v) => v!.toLowerCase().includes(termo));
    });
  }, [itens, periodo, termo]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) carregar();
        else {
          setBusca("");
          setPeriodo("todas");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Publicadas"
          className={cn("relative text-secondary-foreground hover:bg-secondary-foreground/10", className)}
        >
          <CheckCircle2 className="h-4 w-4" />
          {noMes > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-positive px-1 text-[9px] font-bold leading-none text-white">
              {noMes}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicadas</DialogTitle>
          <DialogDescription>
            Captações já gravadas e publicadas. Ficam fora do quadro, mas seguem consultáveis aqui.
          </DialogDescription>
        </DialogHeader>

        {itens.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodo(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      periodo === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {PERIODO_LABEL[p]}
                  </button>
                ))}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                <strong className="text-foreground">{noMes}</strong> este mês
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por endereço, bairro ou código…"
                className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )}

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {itens.length === 0 ? "Nenhuma captação publicada ainda." : "Nenhuma captação nesse filtro."}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {filtradas.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {it.endereco}
                    {it.imovel_codigo && (
                      <span className="ml-1.5 rounded bg-positive/10 px-1.5 py-0.5 text-[11px] font-semibold text-positive">
                        {it.imovel_codigo}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {it.bairro ? `${it.bairro} · ` : ""}
                    {it.publicada_em ? `publicada ${dataCurta(it.publicada_em)} · ${relativo(it.publicada_em)}` : "sem data"}
                  </p>
                </div>
                <Link
                  href={`/captacao/${it.id}`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  Abrir <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
