const RTF = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 2 dias", "há 3 h", "agora". */
export function relativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (Math.abs(min) < 1) return "agora";
  if (Math.abs(min) < 60) return RTF.format(-min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return RTF.format(-h, "hour");
  const d = Math.round(h / 24);
  if (Math.abs(d) < 30) return RTF.format(-d, "day");
  const meses = Math.round(d / 30);
  return RTF.format(-meses, "month");
}

/** Data curta dd/mm. */
export function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Prazo (em dias) para decidir uma captação na coluna "Decisão". */
export const PRAZO_DECISAO_DIAS = 5;

/** Dias restantes até `desde + prazo`. 0 = vence hoje; negativo = atrasada. */
export function diasRestantes(desdeIso: string, prazoDias = PRAZO_DECISAO_DIAS): number {
  const vence = new Date(desdeIso).getTime() + prazoDias * 86400000;
  return Math.ceil((vence - Date.now()) / 86400000);
}

/** Dias parados desde a última atualização. */
export function diasParado(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Converte texto monetário (aceita "1.234,56" ou "1234.56") em número. */
export function parseMoeda(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formata em BRL: R$ 1.234,56. */
export function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Só os dígitos de um telefone. */
export function soDigitos(tel: string | null): string {
  return (tel ?? "").replace(/\D/g, "");
}

/**
 * Link wa.me a partir do WhatsApp. Assume Brasil (+55) quando o número
 * vem sem código do país (10 ou 11 dígitos: DDD + número).
 */
export function whatsappLink(tel: string | null): string | null {
  let d = soDigitos(tel);
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

/** Máscara progressiva enquanto digita: (11) 98888-7777. */
export function maskTelefone(valor: string): string {
  const d = soDigitos(valor).replace(/^55/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Formata para exibição: (11) 98888-7777. */
export function formatarTelefone(tel: string | null): string {
  const d = soDigitos(tel).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel ?? "";
}
