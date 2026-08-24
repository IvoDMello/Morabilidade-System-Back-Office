"use client";

// Select estilizado (Radix) para os filtros do painel. O <select> nativo abre
// o dropdown do sistema operacional, que não aceita CSS — este componente
// desenha a lista aberta com o mesmo visual dos demais inputs do painel.

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

// Radix reserva value="" para "sem seleção", então a opção "Todos" usa um
// sentinela interno e o componente traduz de/para "" na borda.
const VALOR_TODOS = "__todos__";

export interface OpcaoSelect {
  value: string;
  label: string;
}

interface FiltroSelectProps {
  /** "" significa sem filtro (opção "Todos"). */
  value: string;
  onChange: (value: string) => void;
  options: OpcaoSelect[];
  /** Rótulo da opção que limpa o filtro, ex.: "Todos os tipos". */
  todosLabel: string;
  disabled?: boolean;
  /** Nome acessível do campo. Os <label> da gaveta são só visuais (não têm
   * htmlFor, porque o gatilho do Radix não é um <input> com id), então sem isto
   * o leitor de tela anuncia só o valor escolhido, sem dizer de que campo é. */
  ariaLabel?: string;
}

export function FiltroSelect({
  value,
  onChange,
  options,
  todosLabel,
  disabled,
  ariaLabel,
}: FiltroSelectProps) {
  return (
    <Select.Root
      value={value || VALOR_TODOS}
      onValueChange={(v) => onChange(v === VALOR_TODOS ? "" : v)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={
          "group flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-sm border border-[#e8e5da] " +
          "rounded-xl bg-[#ffffff] text-[#26241c] transition-colors hover:border-[#d5d0c0] " +
          "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/25 focus:border-[#585a4f] " +
          "data-[state=open]:border-[#585a4f] data-[state=open]:ring-2 data-[state=open]:ring-[#585a4f]/25 " +
          "disabled:cursor-default disabled:bg-white disabled:text-[#a49d8b] disabled:hover:border-[#e8e5da] " +
          "data-[placeholder]:text-[#a49d8b] [&>span]:truncate [&>span]:text-left"
        }
      >
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown className="w-4 h-4 shrink-0 text-[#a49d8b] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className={
            "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[#e8e5da] " +
            "bg-white shadow-lg shadow-[#26241c]/10"
          }
        >
          <Select.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-slate-400">
            <ChevronUp className="w-4 h-4" />
          </Select.ScrollUpButton>

          <Select.Viewport className="max-h-64 p-1">
            <Item value={VALOR_TODOS} label={todosLabel} destaque />
            {options.length > 0 && <Select.Separator className="my-1 h-px bg-[#f1efe7]" />}
            {options.map((op) => (
              <Item key={op.value} value={op.value} label={op.label} />
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function Item({ value, label, destaque }: { value: string; label: string; destaque?: boolean }) {
  return (
    <Select.Item
      value={value}
      className={
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none " +
        "transition-colors data-[highlighted]:bg-[#f5f4ee] " +
        "data-[state=checked]:font-medium data-[state=checked]:text-[#585a4f] " +
        (destaque ? "text-[#938d7c]" : "text-[#4a473d]")
      }
    >
      <Select.ItemText>{label}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
        <Check className="w-4 h-4 text-[#585a4f]" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
