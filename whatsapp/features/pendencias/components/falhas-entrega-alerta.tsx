import { ShieldAlert } from "lucide-react";
import { MOTIVO_RECUSA_ACAO } from "@/lib/webhook-diagnostico";
import { formatDateTime } from "@/lib/utils";
import type { WebhookFalhaResumo } from "@/types/webhook-delivery";

/**
 * Alarme de mensagens que nem chegaram a entrar no sistema.
 *
 * É diferente de tudo o mais em /pendencias: as outras filas são trabalho a
 * fazer, esta é um defeito de infraestrutura. Uma mensagem recusada no webhook
 * não aparece em conversa nenhuma — não há onde procurar por ela. Sem este
 * aviso, o sintoma que sobra é "o cliente disse que mandou e não chegou", que é
 * indistinguível de dez outras causas.
 *
 * Por isso fica no topo e não é uma aba: aba se escolhe visitar.
 */
export function FalhasEntregaAlerta({ falhas }: { falhas: WebhookFalhaResumo[] }) {
  if (falhas.length === 0) return null;

  return (
    <section
      // `alert` porque isto não é conteúdo da página: é uma condição que
      // apareceu e precisa ser anunciada a quem usa leitor de tela.
      role="alert"
      className="rounded-xl border border-[rgba(196,85,62,0.35)] bg-[rgba(196,85,62,0.10)] p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ember" aria-hidden />

        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[14.5px] font-semibold text-ember">
            Mensagens recusadas antes de entrar no sistema
          </h2>

          <ul className="flex flex-col gap-2">
            {falhas.map((falha) => (
              <li key={falha.motivo} className="text-[13px] leading-snug">
                <p className="font-medium">{MOTIVO_RECUSA_ACAO[falha.motivo]}</p>
                <p className="text-muted-foreground">
                  {falha.ocorrencias} {falha.ocorrencias === 1 ? "ocorrência" : "ocorrências"}
                  {" · desde "}
                  {formatDateTime(falha.desde)}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-[12.5px] text-muted-foreground">
            Estas mensagens não estão em nenhuma conversa. Depois de corrigir, o
            histórico delas continua só no aplicativo do celular.
          </p>
        </div>
      </div>
    </section>
  );
}
