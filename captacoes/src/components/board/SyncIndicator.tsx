"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useBoard } from "@/stores/board";
import { cn } from "@/lib/utils";

/**
 * Mostra o estado de sincronização: salvando, salvo (some sozinho),
 * e o status da conexão em tempo real (online / reconectando / offline).
 */
export function SyncIndicator() {
  const { salvando, salvoEm, conexao } = useBoard();
  const [mostrarSalvo, setMostrarSalvo] = useState(false);

  // "Salvo" aparece por alguns segundos após concluir uma gravação.
  useEffect(() => {
    if (salvoEm == null) return;
    setMostrarSalvo(true);
    const t = setTimeout(() => setMostrarSalvo(false), 2000);
    return () => clearTimeout(t);
  }, [salvoEm]);

  let icon: React.ReactNode;
  let texto: string;
  let cor: string;

  if (salvando > 0) {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    texto = "Salvando…";
    cor = "text-secondary-foreground/80";
  } else if (conexao === "offline") {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    texto = "Sem conexão";
    cor = "text-destructive";
  } else if (conexao === "conectando") {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    texto = "Reconectando…";
    cor = "text-secondary-foreground/70";
  } else if (mostrarSalvo) {
    icon = <Check className="h-3.5 w-3.5" />;
    texto = "Salvo";
    cor = "text-positive";
  } else {
    icon = <Cloud className="h-3.5 w-3.5" />;
    texto = "Sincronizado";
    cor = "text-secondary-foreground/60";
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cor)}
      title={conexao === "online" ? "Atualizações em tempo real ativas" : "Tempo real indisponível"}
      aria-live="polite"
    >
      {icon}
      <span className="hidden sm:inline">{texto}</span>
    </span>
  );
}
