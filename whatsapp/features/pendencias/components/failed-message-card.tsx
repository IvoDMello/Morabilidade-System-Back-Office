import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { PendingRelativeTime } from "./pending-relative-time";
import { formatPhone } from "@/lib/utils";
import type { FailedOutboundMessage } from "@/types/whatsapp";

/**
 * Um envio que a Meta recusou.
 *
 * O que este cartão resolve: o motivo da recusa já era gravado no banco
 * (`error_message`) e não aparecia em lugar nenhum — quem via o triângulo
 * vermelho na thread não tinha como saber se foi janela de 24h fechada, número
 * inválido ou template recusado, que são problemas com respostas
 * completamente diferentes.
 *
 * O texto que falhou vem junto porque é o que a pessoa precisa para reenviar:
 * sem ele, resolver a falha começa por reconstruir o que se queria dizer.
 */
export function FailedMessageCard({ item }: { item: FailedOutboundMessage }) {
  return (
    <li className="rounded-xl border border-[rgba(196,85,62,0.28)] bg-[rgba(196,85,62,0.06)] p-3.5">
      <div className="flex items-start gap-3">
        <AvatarInitials name={item.contactName} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/contatos/${item.contactId}`}
              className="truncate text-[14.5px] font-semibold hover:underline"
            >
              {item.contactName}
            </Link>
            <span className="text-[12.5px] text-muted-foreground">
              {formatPhone(item.contactPhone)}
            </span>
            <span className="ml-auto text-[12px] text-muted-foreground">
              <PendingRelativeTime date={item.waTimestamp} />
            </span>
          </div>

          <p className="line-clamp-2 text-[13.5px] text-muted-foreground">{item.body}</p>

          <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-ember">
            <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {/* Sem motivo da Meta, dizer isso é mais honesto que deixar em
                  branco: a pessoa sabe que precisa olhar a conversa. */}
              {item.errorMessage ?? "Não entregue — a Meta não informou o motivo."}
            </span>
          </p>

          <Link
            href={`/?c=${item.contactId}`}
            className="text-[12.5px] font-medium text-olive underline-offset-2 hover:underline"
          >
            Abrir conversa para reenviar
          </Link>
        </div>
      </div>
    </li>
  );
}
