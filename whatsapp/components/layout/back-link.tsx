"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { getParentRoute } from "@/constants/nav";
import { cn } from "@/lib/utils";

/**
 * Seta de voltar das telas internas (ficha do contato, formulários...), onde a
 * barra de navegação sozinha não diz como sair. Some nas telas de primeiro
 * nível — ver getParentRoute.
 *
 * Alvo de 40px em volta do ícone: no celular é toque, não clique, e o ícone de
 * 20px sozinho não dava onde acertar.
 */
export function BackLink({
  className,
  withLabel = false,
}: {
  className?: string;
  withLabel?: boolean;
}) {
  const pathname = usePathname();
  const parent = getParentRoute(pathname);
  if (!parent) return null;

  const text = parent.label ? `Voltar para ${parent.label}` : "Voltar";

  return (
    <Link
      href={parent.href}
      aria-label={withLabel ? undefined : text}
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 rounded-lg text-foreground outline-none transition-colors hover:bg-veil/6 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        withLabel
          ? "px-2.5 text-sm text-muted-foreground hover:text-foreground"
          : "w-10 justify-center",
        className,
      )}
    >
      <ArrowLeft className={withLabel ? "h-4 w-4" : "h-5 w-5"} />
      {withLabel && <span>{text}</span>}
    </Link>
  );
}
