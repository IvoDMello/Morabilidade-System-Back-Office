import { after } from "next/server";

/**
 * Agenda trabalho para rodar **depois** que a resposta HTTP já foi enviada.
 *
 * Existe por causa do webhook da Meta: ela reentrega a mensagem se não
 * receber 200 rápido, então nada que demore pode acontecer antes da resposta.
 * A análise do copiloto leva segundos — precisa sair do caminho crítico.
 *
 * Na Vercel o `after` do Next se apoia em `waitUntil`, que mantém a invocação
 * viva até a promise resolver (limitada pelo `maxDuration` da rota).
 *
 * Fora de um contexto de request (testes, scripts) o `after` lança; nesse caso
 * caímos para execução solta. Em ambos os casos o trabalho é best-effort: uma
 * falha aqui nunca pode derrubar quem chamou, porque a mensagem do cliente já
 * foi gravada e isso é o que não pode se perder.
 */
export function depoisDaResposta(tarefa: () => Promise<unknown>): void {
  const seguro = () =>
    tarefa().catch((erro) => {
      console.error("[after-response] tarefa em segundo plano falhou:", erro);
    });

  try {
    after(seguro);
  } catch {
    void seguro();
  }
}
