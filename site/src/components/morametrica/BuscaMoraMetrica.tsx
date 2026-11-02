"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Map as MapaIcon, MapPin, Search } from "lucide-react";
import { sugerirMoraMetrica, type RadarSugestao } from "@/lib/api";
import { EXEMPLOS_BUSCA, novaBusca } from "@/lib/morametrica";
import { cn } from "@/lib/utils";
import { LinkBusca, useNavegacao } from "./Navegacao";

function urlSugestao(s: RadarSugestao): string {
  if (s.tipo === "bairro") return novaBusca({ bairro: s.bairro ?? undefined, q: s.consulta });
  // Com número digitado, a sugestão vem como "Avenida Vieira Souto, 510"
  const numero = s.consulta.match(/,\s*(\d+)$/)?.[1];
  return novaBusca({ cl: String(s.cl), numero, q: s.consulta });
}

/** Campo de busca com autocomplete de ruas e bairros (combobox ARIA). */
export function BuscaMoraMetrica({ valorInicial = "" }: { valorInicial?: string }) {
  const { navegar, carregando } = useNavegacao();
  const [texto, setTexto] = useState(valorInicial);
  const [sugestoes, setSugestoes] = useState<RadarSugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  // Só busca sugestões quando o texto muda por digitação, não quando a URL muda
  const digitou = useRef(false);
  const id = useId();
  const idLista = `${id}-lista`;

  // Exemplo clicado ou link de outro resultado: o campo acompanha a URL
  useEffect(() => {
    digitou.current = false;
    setTexto(valorInicial);
  }, [valorInicial]);

  useEffect(() => {
    if (!digitou.current) return;
    const termo = texto.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      setAberto(false);
      return;
    }
    const controle = new AbortController();
    const espera = setTimeout(async () => {
      setBuscandoSugestoes(true);
      try {
        const lista = await sugerirMoraMetrica(termo, controle.signal);
        setSugestoes(lista);
        setAtivo(-1);
        setAberto(lista.length > 0);
      } catch {
        // abortada pela próxima tecla ou falha de rede: a busca normal segue funcionando
      } finally {
        if (!controle.signal.aborted) setBuscandoSugestoes(false);
      }
    }, 200);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [texto]);

  function buscar(url: string, rotulo: string) {
    digitou.current = false;
    setTexto(rotulo);
    setAberto(false);
    setSugestoes([]);
    campo.current?.blur();
    navegar(url);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const escolhida = aberto && ativo >= 0 ? sugestoes[ativo] : undefined;
    if (escolhida) {
      buscar(urlSugestao(escolhida), escolhida.consulta);
      return;
    }
    const termo = texto.trim();
    if (termo) buscar(novaBusca({ q: termo }), termo);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      setAtivo(-1);
      return;
    }
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => (i + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? sugestoes.length - 1 : i - 1));
    }
  }

  const listaVisivel = aberto && sugestoes.length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form role="search" onSubmit={enviar} className="relative">
        <label htmlFor={`${id}-campo`} className="sr-only">
          Endereço, rua ou bairro
        </label>
        <div className="flex items-stretch gap-1.5 bg-white rounded-2xl shadow-xl shadow-black/25 p-1.5 sm:p-2">
          <div className="relative flex-1 min-w-0 flex items-center">
            <Search className="absolute left-3.5 w-5 h-5 text-[#7a7c72] pointer-events-none" aria-hidden />
            <input
              ref={campo}
              id={`${id}-campo`}
              type="text"
              role="combobox"
              aria-expanded={listaVisivel}
              aria-controls={idLista}
              aria-autocomplete="list"
              aria-activedescendant={listaVisivel && ativo >= 0 ? `${idLista}-${ativo}` : undefined}
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              value={texto}
              onChange={(e) => {
                digitou.current = true;
                setTexto(e.target.value);
              }}
              onKeyDown={teclas}
              onFocus={() => sugestoes.length > 0 && setAberto(true)}
              onBlur={() => setAberto(false)}
              placeholder="Rua e número ou bairro"
              className="w-full bg-transparent pl-11 pr-9 py-3 sm:py-3.5 text-base text-[#2d2f28] placeholder:text-[#9a9c92] rounded-xl focus:outline-none"
            />
            {buscandoSugestoes && (
              <Loader2 className="absolute right-3 w-4 h-4 animate-spin text-[#7a7c72]" aria-hidden />
            )}
          </div>
          <button
            type="submit"
            aria-label="Buscar"
            disabled={carregando}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#585a4f] hover:bg-[#4a4d43] text-white font-semibold px-4 sm:px-7 text-base transition disabled:opacity-80"
          >
            {carregando ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            ) : (
              <Search className="w-5 h-5 sm:hidden" aria-hidden />
            )}
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </div>

        {listaVisivel && (
          <ul
            id={idLista}
            role="listbox"
            aria-label="Sugestões"
            className="absolute left-0 right-0 top-full mt-2 z-30 max-h-80 overflow-y-auto rounded-xl border border-[#e4e1d6] bg-white text-left shadow-xl"
          >
            {sugestoes.map((s, i) => (
              <li
                key={`${s.tipo}-${s.cl ?? s.bairro}`}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === ativo}
                // mousedown dispara antes do blur do campo, que fecha a lista
                onMouseDown={(e) => {
                  e.preventDefault();
                  buscar(urlSugestao(s), s.consulta);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 cursor-pointer",
                  i === ativo && "bg-[#f7f6f2]",
                )}
              >
                {s.tipo === "bairro" ? (
                  <MapaIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#9a8d3a]" aria-hidden />
                ) : (
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#9a8d3a]" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#2d2f28]">{s.consulta}</span>
                  {s.detalhe && <span className="block truncate text-xs text-[#7a7c72]">{s.detalhe}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-[rgba(252,252,252,0.6)]">Experimente:</span>
        {EXEMPLOS_BUSCA.map((exemplo) => (
          <LinkBusca
            key={exemplo}
            href={novaBusca({ q: exemplo })}
            className="rounded-full border border-[rgba(216,203,106,0.45)] bg-[rgba(216,203,106,0.12)] px-3 py-1 text-[#e8dea0] hover:bg-[rgba(216,203,106,0.22)] transition"
          >
            {exemplo}
          </LinkBusca>
        ))}
      </div>
    </div>
  );
}
