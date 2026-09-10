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

/**
 * Largura útil do conteúdo. No celular é a tela inteira; no desktop o app
 * para de esticar e centraliza — uma lista de cartões com 1900px de largura
 * é ilegível, e é o mesmo trilho para cabeçalho, barras e corpo, senão as
 * colunas de cada faixa não se alinham verticalmente.
 */
export const CONTAINER = "mx-auto w-full max-w-[1180px]";

/** Elevação no hover — só onde existe ponteiro de verdade. */
export const HOVER_CARD =
  "lg:transition-shadow lg:hover:shadow-[0_2px_4px_rgba(46,48,42,0.06),0_16px_32px_-20px_rgba(46,48,42,0.32)]";
