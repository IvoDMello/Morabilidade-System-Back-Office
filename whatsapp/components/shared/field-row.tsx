import { cn } from "@/lib/utils";

/**
 * Linha de ficha: rótulo à esquerda, controle à direita.
 *
 * Os campos editáveis da ficha do contato cresceram um a um, cada um
 * embrulhando o próprio rótulo do seu jeito — "Responsável:" com dois-pontos
 * colado no select, etiquetas sem rótulo nenhum. Sem uma linha comum, cada
 * campo novo inventa a própria e a coluna vira uma pilha desalinhada.
 *
 * O controle é empurrado para a direita (`ml-auto`) para que os campos
 * alinhem entre si mesmo com rótulos de larguras diferentes.
 */
export function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center gap-3", className)}>
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {children}
      </div>
    </div>
  );
}
