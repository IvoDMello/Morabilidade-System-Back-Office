"use client";

// Seleção múltipla para os filtros do painel, com o mesmo visual do
// FiltroSelect (que é de escolha única). Construído sobre DropdownMenu em vez
// de Select porque Select do Radix é single-value por contrato — foi trocar o
// filtro de bairro por ele que fez o painel perder o multi-bairro que a API
// sempre soube responder.

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

interface FiltroMultiSelectProps {
  /** Lista vazia = sem filtro. */
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  /** Rótulo quando nada está escolhido, ex.: "Todos os bairros". */
  vazioLabel: string;
  /** Palavra usada no resumo "3 bairros", no plural. */
  substantivoPlural: string;
  disabled?: boolean;
}

/** "Todos os bairros" · "Ipanema" · "Ipanema, Leblon" · "3 bairros". */
function resumo(value: string[], vazioLabel: string, plural: string): string {
  if (value.length === 0) return vazioLabel;
  // Até dois cabem por extenso; daí em diante o nome de cada um deixa de caber
  // no gatilho e a contagem informa mais que uma lista cortada no meio.
  if (value.length <= 2) return value.join(", ");
  return `${value.length} ${plural}`;
}

export function FiltroMultiSelect({
  value,
  onChange,
  options,
  vazioLabel,
  substantivoPlural,
  disabled,
}: FiltroMultiSelectProps) {
  function alternar(opcao: string) {
    onChange(
      value.includes(opcao) ? value.filter((v) => v !== opcao) : [...value, opcao],
    );
  }

  const vazio = value.length === 0;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        aria-label={vazioLabel}
        className={
          "group flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-sm border border-[#e8e5da] " +
          "rounded-xl bg-[#ffffff] transition-colors hover:border-[#d5d0c0] " +
          "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/25 focus:border-[#585a4f] " +
          "data-[state=open]:border-[#585a4f] data-[state=open]:ring-2 data-[state=open]:ring-[#585a4f]/25 " +
          "disabled:cursor-default disabled:bg-white disabled:text-[#a49d8b] disabled:hover:border-[#e8e5da] " +
          (vazio ? "text-[#a49d8b]" : "text-[#26241c]")
        }
      >
        <span className="truncate text-left">
          {resumo(value, vazioLabel, substantivoPlural)}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[#a49d8b] transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={
            "z-50 w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto rounded-xl " +
            "border border-[#e8e5da] bg-white p-1 shadow-lg shadow-[#26241c]/10"
          }
        >
          {/* Limpar tudo, no lugar onde ficava o "Todos" do select de escolha
              única — sem isso, desmarcar seis bairros custaria seis cliques. */}
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              onChange([]);
            }}
            className={
              "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none " +
              "transition-colors data-[highlighted]:bg-[#f5f4ee] text-[#938d7c]"
            }
          >
            {vazioLabel}
            {vazio && (
              <span className="absolute right-3 inline-flex items-center">
                <Check className="w-4 h-4 text-[#585a4f]" />
              </span>
            )}
          </DropdownMenu.Item>

          {options.length > 0 && (
            <DropdownMenu.Separator className="my-1 h-px bg-[#f1efe7]" />
          )}

          {options.map((opcao) => {
            const marcado = value.includes(opcao);
            return (
              <DropdownMenu.CheckboxItem
                key={opcao}
                checked={marcado}
                // Sem isto o menu fecha a cada escolha, e escolher três bairros
                // viraria abrir-fechar três vezes.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => alternar(opcao)}
                className={
                  "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none " +
                  "transition-colors data-[highlighted]:bg-[#f5f4ee] " +
                  (marcado ? "font-medium text-[#585a4f]" : "text-[#4a473d]")
                }
              >
                {opcao}
                <DropdownMenu.ItemIndicator className="absolute right-3 inline-flex items-center">
                  <Check className="w-4 h-4 text-[#585a4f]" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
