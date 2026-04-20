import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export function labelTipoImovel(tipo: string): string {
  const labels: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
    sala: "Sala comercial",
    galpao: "Galpão",
    loja: "Loja",
    cobertura: "Cobertura",
    kitnet: "Kitnet / Studio",
    outro: "Outro",
  };
  return labels[tipo] ?? tipo;
}

export function labelCondicao(condicao: string): string {
  const labels: Record<string, string> = {
    novo: "Novo",
    usado: "Usado",
    em_construcao: "Em construção",
    na_planta: "Na planta",
  };
  return labels[condicao] ?? condicao;
}

export function labelMobiliado(mobiliado: string): string {
  const labels: Record<string, string> = {
    sim: "Mobiliado",
    nao: "Sem mobília",
    "semi-mobiliado": "Semi-mobiliado",
  };
  return labels[mobiliado] ?? mobiliado;
}

export function labelTipoNegocio(tipo: string): string {
  const labels: Record<string, string> = {
    venda: "Venda",
    locacao: "Locação",
    ambos: "Venda e Locação",
  };
  return labels[tipo] ?? tipo;
}
