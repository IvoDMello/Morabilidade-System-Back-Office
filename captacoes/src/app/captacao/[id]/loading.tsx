import { Skeleton } from "@/components/ui/skeleton";

export default function CaptacaoLoading() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="h-7 w-2/3" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </main>
  );
}
