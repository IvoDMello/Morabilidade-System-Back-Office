/**
 * Setup compartilhado dos testes.
 *
 * Existe por causa de `window.matchMedia`: o jsdom não implementa, e qualquer
 * componente que use `useMediaQuery` estoura ao montar — inclusive em testes que
 * não têm nada a ver com responsividade e só renderizam a árvore por cima. Foi
 * o que aconteceu quando o compositor passou a detectar ponteiro grosso: quatro
 * testes da ficha do contato quebraram sem que a ficha tivesse mudado.
 *
 * Fica aqui, e não em cada arquivo, porque a alternativa é lembrar de stubar em
 * todo teste novo que renderize um componente que um dia venha a consultar
 * viewport. O default é o desktop (`matches: false`), que preserva o
 * comportamento de todos os testes escritos antes do hook existir; quem quiser
 * simular toque sobrescreve com `vi.stubGlobal("matchMedia", ...)`.
 */

/** MediaQueryList mínima porém honesta: o hook chama `.matches` e assina
 * `change`, então as duas coisas precisam existir de verdade. */
function criarMediaQueryList(query: string): MediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const lista: MediaQueryList = {
    media: query,
    // Desktop/ponteiro fino: o que os testes assumiam antes de o hook existir.
    matches: false,
    onchange: null,
    addEventListener: (tipo: string, ouvinte: EventListenerOrEventListenerObject) => {
      if (tipo === "change") listeners.add(ouvinte as (e: MediaQueryListEvent) => void);
    },
    removeEventListener: (tipo: string, ouvinte: EventListenerOrEventListenerObject) => {
      if (tipo === "change") listeners.delete(ouvinte as (e: MediaQueryListEvent) => void);
    },
    // API legada, ainda usada por bibliotecas antigas.
    addListener: (ouvinte) => {
      if (ouvinte) listeners.add(ouvinte as (e: MediaQueryListEvent) => void);
    },
    removeListener: (ouvinte) => {
      if (ouvinte) listeners.delete(ouvinte as (e: MediaQueryListEvent) => void);
    },
    dispatchEvent: (evento: Event) => {
      listeners.forEach((ouvinte) => ouvinte(evento as MediaQueryListEvent));
      return true;
    },
  } as MediaQueryList;

  return lista;
}

// O ambiente padrão da suíte é node (testes de lógica); só instala onde há DOM.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = criarMediaQueryList as unknown as typeof window.matchMedia;
}
