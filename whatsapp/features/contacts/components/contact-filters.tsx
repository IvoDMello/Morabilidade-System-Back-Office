"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BellRing, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS } from "@/constants/contact-categories";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/constants/contact-status";
import { NEXT_ACTIONS, NEXT_ACTION_LABELS } from "@/constants/next-actions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Property } from "@/types/property";

const ALL = "all";

export function ContactFilters({ properties }: { properties: Property[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebouncedValue(search, 350);
  const isFirstRender = useRef(true);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/contatos?${params.toString()}`);
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateParam("search", debouncedSearch || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const nextAction = searchParams.get("nextAction");
  const propertyId = searchParams.get("propertyId");
  const hasReminders = searchParams.get("hasReminders") === "1";
  const isFavorite = searchParams.get("isFavorite") === "1";

  // Chip compacto: mostra o rótulo curto quando nada está selecionado e o
  // valor escolhido (com destaque dourado) quando o filtro está ativo.
  const chipClass = (active: boolean) =>
    cn(
      "h-8 w-auto shrink-0 gap-1.5 rounded-lg border px-3 text-[12.5px] whitespace-nowrap",
      active
        ? "border-primary/35 bg-primary/10 text-gold"
        : "border-veil/9 bg-card text-ink-mid",
    );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar contatos"
          placeholder="Buscar por nome, telefone ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category ?? ALL}
          onValueChange={(value) => updateParam("category", value)}
        >
          <SelectTrigger className={chipClass(Boolean(category))}>
            <SelectValue placeholder="Categoria">
              {(value: string) =>
                value === ALL
                  ? "Categoria"
                  : CONTACT_CATEGORY_LABELS[value as keyof typeof CONTACT_CATEGORY_LABELS]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {CONTACT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {searchParams.get("view") !== "pipeline" && (
          <Select
            value={status ?? ALL}
            onValueChange={(value) => updateParam("status", value)}
          >
            <SelectTrigger className={chipClass(Boolean(status))}>
              <SelectValue placeholder="Status">
                {(value: string) =>
                  value === ALL
                    ? "Status"
                    : CONTACT_STATUS_LABELS[value as keyof typeof CONTACT_STATUS_LABELS]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={nextAction ?? ALL}
          onValueChange={(value) => updateParam("nextAction", value)}
        >
          <SelectTrigger className={chipClass(Boolean(nextAction))}>
            <SelectValue placeholder="Ações">
              {(value: string) =>
                value === ALL
                  ? "Ações"
                  : NEXT_ACTION_LABELS[value as keyof typeof NEXT_ACTION_LABELS]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as próximas ações</SelectItem>
            {NEXT_ACTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {properties.length > 0 && (
          <Select
            value={propertyId ?? ALL}
            onValueChange={(value) => updateParam("propertyId", value)}
          >
            <SelectTrigger className={chipClass(Boolean(propertyId))}>
              <SelectValue placeholder="Imóvel">
                {(value: string) =>
                  value === ALL
                    ? "Imóvel"
                    : (properties.find((p) => p.id === value)?.code ?? "")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os imóveis</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button
          type="button"
          aria-pressed={hasReminders}
          onClick={() => updateParam("hasReminders", hasReminders ? null : "1")}
          className={cn(chipClass(hasReminders), "inline-flex items-center transition-colors")}
        >
          <BellRing className="h-3.5 w-3.5" />
          Lembretes
        </button>

        <button
          type="button"
          aria-pressed={isFavorite}
          onClick={() => updateParam("isFavorite", isFavorite ? null : "1")}
          className={cn(chipClass(isFavorite), "inline-flex items-center transition-colors")}
        >
          <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-gold")} />
          Favoritos
        </button>
      </div>
    </div>
  );
}
