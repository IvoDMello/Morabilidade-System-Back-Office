import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WeeklyDelta } from "@/types/dashboard";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Variação percentual dos últimos 7 dias (DB-3) — omitido quando não há base de comparação. */
  delta?: WeeklyDelta;
}

/** KPI do redesign: rótulo à esquerda, chip de ícone à direita e número grande
 * abaixo, com variação semanal ao lado do número. */
export function StatCard({ label, value, icon: Icon, delta }: StatCardProps) {
  return (
    <Card>
      <CardContent className="py-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary/14 text-gold">
            <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
          </span>
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
          {delta !== undefined && delta !== null && delta !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                delta > 0 ? "text-jade-soft" : "text-ember",
              )}
            >
              {delta > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
