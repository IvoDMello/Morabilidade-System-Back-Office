/** Rótulo de seção em versalete (FM-1) — agrupa campos por peso semântico
 * ("Identificação" / "Classificação" / "Notas") em vez de uma coluna única
 * onde tudo tem o mesmo peso visual. */
export function FormSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}
