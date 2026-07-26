import { normalizePhone } from "./phone";

/**
 * Monta o link do WhatsApp a partir de um telefone em qualquer formato.
 * Remove tudo que não é dígito e garante o prefixo do Brasil (55) quando ausente.
 */
export function buildWhatsAppUrl(phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}`;
}
