"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";

// Busca e filtros mudam a URL e o servidor monta o novo resultado. A transição
// mantém o resultado atual na tela (esmaecido) até o próximo chegar, em vez de
// piscar a página inteira; o campo de busca e o resultado compartilham esse
// estado por aqui. Fora da MoraMétrica (o atalho da home), a busca leva a outra
// página e por isso abre no topo.

interface Navegacao {
  navegar: (url: string) => void;
  carregando: boolean;
}

const Contexto = createContext<Navegacao | null>(null);

export function ProvedorNavegacao({
  children,
  manterRolagem = true,
}: {
  children: React.ReactNode;
  manterRolagem?: boolean;
}) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();

  const navegar = useCallback(
    (url: string) => iniciar(() => router.push(url, { scroll: !manterRolagem })),
    [router, manterRolagem],
  );

  return <Contexto.Provider value={{ navegar, carregando }}>{children}</Contexto.Provider>;
}

export function useNavegacao(): Navegacao {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useNavegacao fora de ProvedorNavegacao");
  return valor;
}

/** Link que funciona sem JavaScript (e com "abrir em nova aba"), mas que no
 *  clique normal navega pela transição. */
export function LinkBusca({
  href,
  className,
  children,
  ...resto
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navegar } = useNavegacao();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navegar(href);
      }}
      {...resto}
    >
      {children}
    </a>
  );
}
