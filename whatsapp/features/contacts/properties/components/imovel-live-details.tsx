import { cn } from "@/lib/utils";
import type { ImovelResumo } from "@/lib/backoffice-api";

/** Rótulo + cor de cada disponibilidade do catálogo (enum da API principal). */
const DISPONIBILIDADE: Record<string, { label: string; className: string }> = {
  disponivel: {
    label: "Disponível",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  reservado: {
    label: "Reservado",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  vendido_locado: {
    label: "Vendido/Locado",
    className: "bg-muted text-muted-foreground",
  },
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Escolhe o valor a exibir conforme o tipo de negócio do imóvel. */
function formatPreco(imovel: ImovelResumo): string | null {
  const venda = imovel.valorVenda != null ? `${currency.format(imovel.valorVenda)}` : null;
  const locacao =
    imovel.valorLocacao != null ? `${currency.format(imovel.valorLocacao)}/mês` : null;

  if (imovel.tipoNegocio === "locacao") return locacao ?? venda;
  if (imovel.tipoNegocio === "ambos") return [venda, locacao].filter(Boolean).join(" · ") || null;
  return venda ?? locacao;
}

interface ImovelLiveDetailsProps {
  imovel: ImovelResumo;
  className?: string;
}

/**
 * Linha de detalhes ao vivo de um imóvel vinculado: badge de status + bairro +
 * preço, buscados na hora do catálogo real. Só é renderizada quando o código
 * resolveu na API — o snapshot de título continua sendo o fallback quando não.
 */
export function ImovelLiveDetails({ imovel, className }: ImovelLiveDetailsProps) {
  const status = DISPONIBILIDADE[imovel.disponibilidade ?? ""] ?? {
    label: imovel.disponibilidade ?? "—",
    className: "bg-muted text-muted-foreground",
  };
  const preco = formatPreco(imovel);
  const local = [imovel.bairro, imovel.cidade].filter(Boolean).join(", ");

  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-medium",
          status.className,
        )}
      >
        {status.label}
      </span>
      {local && <span className="text-muted-foreground">{local}</span>}
      {preco && (
        <>
          {local && <span className="text-muted-foreground/50">·</span>}
          <span className="font-medium text-muted-foreground">{preco}</span>
        </>
      )}
    </div>
  );
}
