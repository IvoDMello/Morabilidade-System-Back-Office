import type { LucideIcon } from "lucide-react";
import { Users, BellRing, MessageCircle, LayoutDashboard, ListTodo } from "lucide-react";

export type NavBadgeKind = "reminders" | "unreadConversations" | "pendingConversations";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKind?: NavBadgeKind;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/", label: "Conversas", icon: MessageCircle, badgeKind: "unreadConversations" },
  { href: "/pendencias", label: "Pendências", icon: ListTodo, badgeKind: "pendingConversations" },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/lembretes", label: "Lembretes", icon: BellRing, badgeKind: "reminders" },
];

const MOBILE_SECTION_INFO: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Visão geral", subtitle: "Atendimento e contatos em um relance." },
  "/": { title: "Conversas", subtitle: "Mensagens recebidas no WhatsApp." },
  "/pendencias": { title: "Pendências", subtitle: "Conversas aguardando resposta ou follow-up." },
  "/contatos": { title: "Contatos", subtitle: "Gerencie seus contatos." },
  "/lembretes": { title: "Central de Lembretes", subtitle: "Vencidos, hoje e próximos." },
};

/** Título/subtítulo exibidos no header fixo mobile, por seção de navegação. */
export function getMobileSectionInfo(pathname: string) {
  if (pathname !== "/" && MOBILE_SECTION_INFO[pathname] === undefined) {
    const section = NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
    if (section) return MOBILE_SECTION_INFO[section.href];
  }
  return MOBILE_SECTION_INFO[pathname] ?? MOBILE_SECTION_INFO["/"];
}
