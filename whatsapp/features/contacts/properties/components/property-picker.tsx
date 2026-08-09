"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PROPERTY_STAGES,
  PROPERTY_STAGE_COLORS,
  PROPERTY_STAGE_LABELS,
  type PropertyStage,
} from "@/constants/property-stages";
import {
  PROPERTY_RELATIONS,
  PROPERTY_RELATION_COLORS,
  PROPERTY_RELATION_LABELS,
  type PropertyRelation,
} from "@/constants/property-relations";
import { cn } from "@/lib/utils";
import {
  linkPropertyAction,
  unlinkPropertyAction,
  updatePropertyStageAction,
  updatePropertyRelacaoAction,
} from "@/app/contatos/actions";
import { ImovelLiveDetails } from "./imovel-live-details";
import type { ImovelResumo } from "@/lib/backoffice-api";
import type { ID } from "@/types/common";
import type { ContactPropertyWithDetails, Property } from "@/types/property";

interface PropertyPickerProps {
  contactId: ID;
  contactProperties: ContactPropertyWithDetails[];
  allProperties: Property[];
  /** Dados ao vivo do catálogo real, por código. Vazio se a API não respondeu. */
  liveDetails?: Record<string, ImovelResumo>;
}

export function PropertyPicker({
  contactId,
  contactProperties,
  allProperties,
  liveDetails = {},
}: PropertyPickerProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [relacao, setRelacao] = useState<PropertyRelation>("interesse");
  const [stage, setStage] = useState<PropertyStage>("interesse");
  const [isPending, startTransition] = useTransition();

  const linkedPropertyIds = new Set(contactProperties.map((cp) => cp.propertyId));
  const suggestions = allProperties.filter(
    (p) =>
      !linkedPropertyIds.has(p.id) &&
      code.trim().length > 0 &&
      p.code.toLowerCase().includes(code.trim().toLowerCase()),
  );

  function handleLink(codeToLink: string) {
    if (!codeToLink.trim()) return;
    startTransition(async () => {
      try {
        await linkPropertyAction(contactId, { code: codeToLink.trim(), relacao, stage });
        setCode("");
        setRelacao("interesse");
        setStage("interesse");
        setOpen(false);
      } catch {
        toast.error("Não foi possível vincular o imóvel.");
      }
    });
  }

  function handleStageChange(cp: ContactPropertyWithDetails, newStage: string | null) {
    if (!newStage) return;
    startTransition(async () => {
      try {
        await updatePropertyStageAction(contactId, cp.propertyId, cp.code, newStage as PropertyStage);
      } catch {
        toast.error("Não foi possível atualizar a etapa.");
      }
    });
  }

  function handleRelacaoChange(cp: ContactPropertyWithDetails, newRelacao: string | null) {
    if (!newRelacao) return;
    startTransition(async () => {
      try {
        await updatePropertyRelacaoAction(
          contactId,
          cp.propertyId,
          cp.code,
          newRelacao as PropertyRelation,
        );
      } catch {
        toast.error("Não foi possível atualizar o papel.");
      }
    });
  }

  function handleUnlink(cp: ContactPropertyWithDetails) {
    startTransition(async () => {
      try {
        await unlinkPropertyAction(contactId, cp.propertyId, cp.code);
      } catch {
        toast.error("Não foi possível desvincular o imóvel.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {contactProperties.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {contactProperties.map((cp) => (
            <li
              key={cp.propertyId}
              className="flex items-center gap-2 rounded-lg border bg-card p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cp.code}</p>
                {cp.title && <p className="truncate text-xs text-muted-foreground">{cp.title}</p>}
                {liveDetails[cp.code] && (
                  <ImovelLiveDetails imovel={liveDetails[cp.code]} className="mt-1" />
                )}
              </div>
              <Select value={cp.relacao} onValueChange={(v) => handleRelacaoChange(cp, v)}>
                <SelectTrigger
                  size="sm"
                  className={cn("w-auto shrink-0 border-none", PROPERTY_RELATION_COLORS[cp.relacao])}
                >
                  <SelectValue>
                    {(value: string) => PROPERTY_RELATION_LABELS[value as PropertyRelation]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_RELATIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cp.relacao === "interesse" && (
                <Select value={cp.stage} onValueChange={(v) => handleStageChange(cp, v)}>
                  <SelectTrigger
                    size="sm"
                    className={cn("w-auto shrink-0 border-none", PROPERTY_STAGE_COLORS[cp.stage])}
                  >
                    <SelectValue>
                      {(value: string) => PROPERTY_STAGE_LABELS[value as PropertyStage]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => handleUnlink(cp)}
                aria-label={`Desvincular imóvel ${cp.code}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="self-start" />}>
          <Plus className="h-3.5 w-3.5" />
          Vincular imóvel
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Código do imóvel a vincular"
              placeholder="Código do imóvel (ex.: MB-00033)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {suggestions.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCode(p.code)}
                    className="rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    {p.code}
                    {p.title && <span className="text-muted-foreground"> · {p.title}</span>}
                  </button>
                ))}
              </div>
            )}
            <Select value={relacao} onValueChange={(v) => setRelacao(v as PropertyRelation)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => PROPERTY_RELATION_LABELS[value as PropertyRelation]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_RELATIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {relacao === "interesse" && (
              <Select value={stage} onValueChange={(v) => setStage(v as PropertyStage)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => PROPERTY_STAGE_LABELS[value as PropertyStage]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              size="sm"
              loading={isPending}
              disabled={!code.trim()}
              onClick={() => handleLink(code)}
            >
              Vincular
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
