/** Abas da central de pendências. Fica fora do componente porque a página
 * (Server Component) precisa validar o `?tab=` da URL — exports de um módulo
 * "use client" viram referências de cliente e não podem ser chamados no servidor. */
export const PENDENCIAS_TABS = ["aguardando", "lembretes", "followup", "todas"] as const;

export type PendenciasTab = (typeof PENDENCIAS_TABS)[number];

export const PENDENCIAS_TAB_PADRAO: PendenciasTab = "aguardando";

export function isPendenciasTab(value: string | undefined): value is PendenciasTab {
  return PENDENCIAS_TABS.includes(value as PendenciasTab);
}
