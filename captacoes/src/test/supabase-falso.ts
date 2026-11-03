/**
 * Cliente Supabase falso para os testes de src/lib.
 *
 * Cada `from(tabela)`, `rpc(nome)` e `storage.from(bucket)` abre uma cadeia
 * que registra os métodos chamados e, quando aguardada, responde com o que
 * estiver em `respostas` na chave `tabela`, `rpc:nome` ou `storage:metodo`
 * (ou `{ data: null, error: null }`). Uma função na chave recebe a cadeia e
 * decide a resposta, para quando a mesma tabela é lida e escrita no teste.
 */

export type Resposta = { data?: unknown; error?: unknown };
export type Passo = [metodo: string, args: unknown[]];
export type Chamada = { alvo: string; passos: Passo[] };
type Respostas = Record<string, Resposta | ((chamada: Chamada) => Resposta)>;

export function supabaseFalso(respostas: Respostas = {}, usuario: { id: string } | null = { id: "u-1" }) {
  const chamadas: Chamada[] = [];

  function responder(chave: string, chamada: Chamada): Resposta {
    const r = respostas[chave];
    const resposta = typeof r === "function" ? r(chamada) : r;
    return { data: null, error: null, ...resposta };
  }

  function cadeia(alvo: string, chave: string, passosIniciais: Passo[] = []) {
    const chamada: Chamada = { alvo, passos: [...passosIniciais] };
    chamadas.push(chamada);
    const proxy: object = new Proxy(
      {},
      {
        get(_, metodo: string) {
          if (metodo === "then") {
            const resposta = responder(chave, chamada);
            return (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
              Promise.resolve(resposta).then(ok, falha);
          }
          return (...args: unknown[]) => {
            chamada.passos.push([metodo, args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const cliente = {
    chamadas,
    from: (tabela: string) => cadeia(tabela, tabela),
    rpc: (nome: string, params?: unknown) => cadeia(`rpc:${nome}`, `rpc:${nome}`, [["rpc", [params]]]),
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => cadeia(`storage:${bucket}`, "storage:upload", [["upload", args]]),
        createSignedUrl: (...args: unknown[]) =>
          cadeia(`storage:${bucket}`, "storage:createSignedUrl", [["createSignedUrl", args]]),
      }),
    },
  };
  return cliente;
}

/** Passos de uma chamada como objeto `{metodo: args}` (o último vence). */
export function passos(chamada: Chamada): Record<string, unknown[]> {
  return Object.fromEntries(chamada.passos);
}
