import type { LucideIcon } from "lucide-react";
import { Users, MessageCircle, LayoutDashboard, ListTodo, Sparkles } from "lucide-react";
import type { ReminderCounts } from "@/types/dashboard";

export type NavBadgeKind = "unreadConversations" | "aFazer";

export interface NavItem {
  href: string;
  label: string;
  /** Rótulo curto para a barra inferior mobile (cabe melhor com 5 itens). */
  shortLabel?: string;
  icon: LucideIcon;
  badgeKind?: NavBadgeKind;
}

/** Conversas em primeiro: é a tela de trabalho e a porta de entrada do app.
 * "Pendências" reúne conversas aguardando e lembretes — antes eram dois itens
 * que respondiam à mesma pergunta ("o que falta fazer?"). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Conversas", icon: MessageCircle, badgeKind: "unreadConversations" },
  { href: "/pendencias", label: "Pendências", icon: ListTodo, badgeKind: "aFazer" },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/assistente", label: "Assistente", icon: Sparkles },
  { href: "/dashboard", label: "Visão geral", shortLabel: "Resumo", icon: LayoutDashboard },
];

export interface NavCounts {
  reminderCounts: ReminderCounts;
  unreadConversations: number;
  pendingConversations: number;
}

export interface NavBadge {
  count: number;
  /** "unread" = verde (mensagem nova); "action" = vermelho (precisa de você). */
  tone: "unread" | "action";
  /** Substantivo lido por leitor de tela: "3 não lidas". */
  noun: string;
}

/** Contador do item de nav — um só lugar, para o rail do desktop e a barra
 * mobile nunca divergirem. Pendências soma as duas filas que o item agora
 * representa: conversas aguardando e lembretes vencidos. */
export function getNavBadge(item: NavItem, counts: NavCounts): NavBadge | null {
  if (item.badgeKind === "unreadConversations") {
    return { count: counts.unreadConversations, tone: "unread", noun: "não lidas" };
  }
  if (item.badgeKind === "aFazer") {
    return {
      count: counts.pendingConversations + counts.reminderCounts.overdue,
      tone: "action",
      noun: "pendências",
    };
  }
  return null;
}

const MOBILE_SECTION_INFO: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Visão geral", subtitle: "Atendimento e contatos em um relance." },
  "/": { title: "Conversas", subtitle: "Mensagens recebidas no WhatsApp." },
  "/pendencias": { title: "Pendências", subtitle: "Conversas aguardando e lembretes." },
  "/contatos": { title: "Contatos", subtitle: "Gerencie seus contatos." },
  "/assistente": { title: "Assistente", subtitle: "Proponha e confirme ações com a IA." },
};

/** Título/subtítulo exibidos no header fixo mobile, por seção de navegação. */
export function getMobileSectionInfo(pathname: string) {
  if (pathname !== "/" && MOBILE_SECTION_INFO[pathname] === undefined) {
    const section = NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
    if (section) return MOBILE_SECTION_INFO[section.href];
  }
  return MOBILE_SECTION_INFO[pathname] ?? MOBILE_SECTION_INFO["/"];
}
