"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CheckCircle2, Inbox, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contadores } from "@/lib/contadores";

interface Aba {
  href: string;
  label: string;
  Icone: typeof Inbox;
  contador: number;
  /** Contador em vermelho: só quando há retorno atrasado. */
  alerta?: boolean;
}

/**
 * Navegação principal. No celular vai para o RODAPÉ: quatro destinos não
 * cabem confortavelmente no topo e, embaixo, ficam no alcance do polegar
 * (o app é usado em movimento, com uma mão). No desktop vira horizontal no
 * cabeçalho — ver `NavDesktop`.
 */
export function TabBar({ contadores }: { contadores: Contadores }) {
  const pathname = usePathname();

  const abas: Aba[] = [
    { href: "/decidir", label: "Decidir", Icone: Inbox, contador: contadores.decidir },
    { href: "/aprovadas", label: "Aprovadas", Icone: CheckCircle2, contador: contadores.aprovadas },
    { href: "/agenda", label: "Agenda", Icone: Calendar, contador: contadores.agenda },
    {
      href: "/negativadas",
      label: "Negativadas",
      Icone: XCircle,
      contador: contadores.negativadas,
      alerta: contadores.atrasados > 0,
    },
  ];

  return (
    <nav
      aria-label="Seções"
      className="flex flex-none items-stretch border-t border-border bg-background/95 px-1.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden"
    >
      {abas.map((aba) => {
        const ativa = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 py-0.5"
          >
            <span
              className={cn(
                "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                ativa && "bg-secondary/15"
              )}
            >
              <aba.Icone
                className={cn("h-5 w-5", ativa ? "text-foreground" : "text-muted-foreground")}
                strokeWidth={ativa ? 2 : 1.9}
              />
              {aba.contador > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-background px-1 text-[9.5px] font-bold",
                    aba.alerta
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {aba.contador}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10.5px]",
                ativa ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
              )}
            >
              {aba.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Mesma navegação no desktop: horizontal, dentro do cabeçalho olive. */
export function NavDesktop({ contadores }: { contadores: Contadores }) {
  const pathname = usePathname();

  const abas: Aba[] = [
    { href: "/decidir", label: "Decidir", Icone: Inbox, contador: contadores.decidir },
    { href: "/aprovadas", label: "Aprovadas", Icone: CheckCircle2, contador: contadores.aprovadas },
    { href: "/agenda", label: "Agenda", Icone: Calendar, contador: contadores.agenda },
    {
      href: "/negativadas",
      label: "Negativadas",
      Icone: XCircle,
      contador: contadores.negativadas,
      alerta: contadores.atrasados > 0,
    },
  ];

  return (
    <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
      {abas.map((aba) => {
        const ativa = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
              ativa
                ? "bg-white/15 font-semibold text-white"
                : "font-medium text-white/65 hover:bg-white/10 hover:text-white"
            )}
          >
            <aba.Icone className="h-4 w-4" strokeWidth={1.9} />
            {aba.label}
            {aba.contador > 0 && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-px text-[11px] font-bold",
                  aba.alerta ? "bg-destructive text-destructive-foreground" : "bg-white/15 text-white"
                )}
              >
                {aba.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
