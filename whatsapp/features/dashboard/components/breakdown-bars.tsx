import { cn } from "@/lib/utils";

interface BreakdownBarsProps {
  items: { label: string; value: number; color?: string }[];
  tone?: "gold" | "slate";
}

const FILL_CLASSES: Record<NonNullable<BreakdownBarsProps["tone"]>, string> = {
  gold: "bg-[linear-gradient(90deg,#f0e7b8,#e7dda6)]",
  slate: "bg-[linear-gradient(90deg,#a4a698,#83857a)]",
};

/**
 * Barra horizontal para "contagem por categoria/status". Quando `items` traz
 * `color` (ex.: contatos por categoria — DB-2), cada barra usa a cor sólida
 * do badge daquela categoria (com ponto colorido no rótulo); sem `color`, cai
 * no tom único de sempre.
 */
export function BreakdownBars({ items, tone = "gold" }: BreakdownBarsProps) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-[13px]">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="flex w-32 shrink-0 items-center gap-2 truncate text-[12.5px] text-ink-mid">
            {item.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="truncate">{item.label}</span>
          </span>
          <div className="relative h-[7px] flex-1 overflow-hidden rounded-[5px] bg-veil/5">
            <div
              className={cn("h-full rounded-[5px]", !item.color && FILL_CLASSES[tone])}
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-strong">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
