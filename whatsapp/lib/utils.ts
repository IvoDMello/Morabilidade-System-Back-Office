import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A superfície "cartão" do painel: raio, fundo, contorno e elevação.
 *
 * O mesmo objeto aparecia com quatro desenhos diferentes — `rounded-lg border`
 * na lista de contatos e na ficha, `rounded-[11px]` no cartão do Pipeline,
 * `rounded-[14px]` na coluna, `rounded-xl` no primitivo `<Card>`. De perto
 * cada um se defende; juntos, as telas parecem de produtos diferentes.
 *
 * Quem tem cabeçalho e corpo usa `<Card>` (que aplica isto por dentro); quem é
 * um bloco solto — item de lista, painel — usa esta constante. Duas formas de
 * escrever, um valor só para mudar.
 */
export const SUPERFICIE = "rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8"

/** Formata um telefone brasileiro (10 ou 11 dígitos) como (DD) 9XXXX-XXXX. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-11)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(date),
  )
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date))
}
