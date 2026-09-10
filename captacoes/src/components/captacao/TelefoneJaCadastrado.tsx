"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import { useApp } from "@/stores/app";
import { captacoesDoTelefone, nomeDoProprietario } from "@/lib/telefone-cadastrado";
import { dataCurta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/types";

/** Quantas captações listar antes de resumir o resto em "+ N". */
const MAX_LISTADAS = 4;

/**
 * Avisa, enquanto se digita o WhatsApp, que aquele número já tem captação —
 * e mostra quais são, com link para conferir.
 *
 * Número repetido não é erro: o mesmo proprietário costuma ter mais de um
 * imóvel. Por isso o aviso não bloqueia nada; ele só põe na tela o que a
 * pessoa precisa para decidir, e oferece o caminho explícito de "é outro
 * imóvel deste número" — que já aproveita o nome do proprietário registrado.
 *
 * O que segura o cadastro é outra coisa: endereço ou anúncio iguais, checados
 * no submit (ver NovaCaptacaoButton), porque aí o suspeito é o mesmo imóvel.
 */
export function TelefoneJaCadastrado({
  whatsapp,
  onUsarProprietario,
}: {
  whatsapp: string | null | undefined;
  /** Preenche o nome do proprietário no formulário. */
  onUsarProprietario?: (nome: string) => void;
}) {
  const cards = useApp((s) => s.cards);
  const [confirmado, setConfirmado] = useState(false);

  const encontradas = useMemo(
    () => captacoesDoTelefone(cards, whatsapp),
    [cards, whatsapp]
  );

  if (encontradas.length === 0) return null;

  const nome = nomeDoProprietario(encontradas);
  const listadas = encontradas.slice(0, MAX_LISTADAS);
  const restantes = encontradas.length - listadas.length;

  function confirmar() {
    setConfirmado(true);
    if (nome) onUsarProprietario?.(nome);
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        confirmado ? "border-positive/40 bg-positive/10" : "border-amber-300 bg-amber-50"
      )}
    >
      <p
        className={cn(
          "flex items-start gap-2 text-[13px] font-semibold",
          confirmado ? "text-positive" : "text-amber-900"
        )}
      >
        {confirmado ? (
          <Check className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2.4} />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
        )}
        {encontradas.length === 1
          ? "Este número já tem uma captação"
          : `Este número já tem ${encontradas.length} captações`}
      </p>

      <ul className="mt-2 space-y-1.5">
        {listadas.map((c) => (
          <li key={c.id} className="text-[13px] leading-tight">
            <a
              href={`/captacao/${c.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              {c.endereco}
              {c.unidade ? ` · ap ${c.unidade}` : ""}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {c.proprietario_nome ? `${c.proprietario_nome} · ` : ""}
              {STATUS_LABEL[c.status]} · criada em {dataCurta(c.criado_em)}
            </span>
          </li>
        ))}
        {restantes > 0 && (
          <li className="text-[11px] text-muted-foreground">
            + {restantes} {restantes === 1 ? "outra captação" : "outras captações"} neste número
          </li>
        )}
      </ul>

      {confirmado ? (
        <p className="mt-2 text-[12px] leading-snug text-positive">
          Outra captação neste número{nome ? `, de ${nome}` : ""}. Siga preenchendo os dados do
          novo imóvel.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[12px] leading-snug text-amber-900">
            Confira se não é o mesmo imóvel. Se for outro imóvel do mesmo proprietário, pode
            cadastrar normalmente.
          </p>
          <button
            type="button"
            onClick={confirmar}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100"
          >
            É outro imóvel — cadastrar neste número
          </button>
        </>
      )}
    </div>
  );
}
