"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContactViewToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "pipeline" ? "pipeline" : "list";

  function hrefFor(target: "list" | "pipeline") {
    const params = new URLSearchParams(searchParams.toString());
    if (target === "pipeline") params.set("view", "pipeline");
    else params.delete("view");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-[9px] border border-veil/6 bg-card p-[3px]">
      <Link
        href={hrefFor("list")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors",
          view === "list"
            ? "bg-veil/10 text-foreground"
            : "text-muted-foreground hover:text-ink-mid",
        )}
      >
        <List className="h-3.5 w-3.5" />
        Lista
      </Link>
      <Link
        href={hrefFor("pipeline")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors",
          view === "pipeline"
            ? "bg-veil/10 text-foreground"
            : "text-muted-foreground hover:text-ink-mid",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Pipeline
      </Link>
    </div>
  );
}
