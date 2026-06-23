import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <main className="flex h-dvh flex-col bg-muted/30">
      <header className="flex flex-wrap items-center gap-3 border-b bg-secondary px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md bg-secondary-foreground/20" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 bg-secondary-foreground/20" />
            <Skeleton className="h-3 w-16 bg-secondary-foreground/20" />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-9 w-28 bg-secondary-foreground/20" />
          <Skeleton className="h-9 w-9 rounded-full bg-secondary-foreground/20" />
          <Skeleton className="h-9 w-9 rounded-md bg-secondary-foreground/20" />
        </div>
        <Skeleton className="h-9 w-full bg-secondary-foreground/20 sm:ml-auto sm:w-64" />
      </header>
      <div className="flex flex-1 gap-3 overflow-hidden px-4 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-card p-2">
            <Skeleton className="mb-1 h-6 w-40" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-24 w-full" />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
