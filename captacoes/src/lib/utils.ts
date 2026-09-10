import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Uma linha do menu "⋯" do cabeçalho. Os itens de lá vêm de componentes
 * diferentes (nova captação, publicadas, lixeira, sair) e precisam parecer a
 * mesma lista — ícone discreto à esquerda, rótulo sempre visível.
 */
export const ITEM_MENU =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-muted";
