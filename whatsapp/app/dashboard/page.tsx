import { AlertTriangle, Clock, MessageCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { BreakdownBars } from "@/features/dashboard/components/breakdown-bars";
import { UpcomingReminders } from "@/features/dashboard/components/upcoming-reminders";
import { RecentContacts } from "@/features/dashboard/components/recent-contacts";
import { CONTACT_CATEGORY_LABELS, CONTACT_CATEGORY_SOLID } from "@/constants/contact-categories";
import { CONTACT_STATUS_LABELS, CONTACT_STATUS_SOLID_BY_VALUE } from "@/constants/contact-status";
import { getDashboardStats } from "@/services/dashboard.service";
import { getPendingConversationsCount } from "@/services/whatsapp.service";

export default async function DashboardPage() {
  const [stats, conversasAguardando] = await Promise.all([
    getDashboardStats(),
    getPendingConversationsCount(),
  ]);

  const categoryItems = Object.entries(stats.contactsByCategory).map(([value, count]) => ({
    label: CONTACT_CATEGORY_LABELS[value as keyof typeof CONTACT_CATEGORY_LABELS],
    value: count,
    color: CONTACT_CATEGORY_SOLID[value as keyof typeof CONTACT_CATEGORY_SOLID],
  }));

  const statusItems = Object.entries(stats.contactsByStatus).map(([value, count]) => ({
    label: CONTACT_STATUS_LABELS[value as keyof typeof CONTACT_STATUS_LABELS],
    value: count,
    color: CONTACT_STATUS_SOLID_BY_VALUE[value as keyof typeof CONTACT_STATUS_SOLID_BY_VALUE],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden md:block">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Atendimento e contatos em um relance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de contatos"
          value={stats.totalContacts}
          icon={Users}
          delta={stats.totalContactsDelta}
          href="/contatos"
        />
        {/* "Conversas aguardando" no lugar de "Lembretes pendentes": aquele
            contava também o que vence daqui a três semanas, então nunca era a
            pressão do dia — e o atendimento, que é, não aparecia aqui. */}
        <StatCard
          label="Conversas aguardando"
          value={conversasAguardando}
          icon={MessageCircle}
          href="/pendencias?tab=aguardando"
        />
        <StatCard
          label="Lembretes vencidos"
          value={stats.overdueReminders}
          icon={AlertTriangle}
          delta={stats.overdueRemindersDelta}
          href="/pendencias?tab=lembretes"
        />
        <StatCard
          label="Lembretes de hoje"
          value={stats.todayReminders.length}
          icon={Clock}
          delta={stats.todayRemindersDelta}
          href="/pendencias?tab=lembretes"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contatos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownBars items={categoryItems} tone="gold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contatos por status</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownBars items={statusItems} tone="slate" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingReminders reminders={stats.todayReminders} />
        <RecentContacts contacts={stats.recentContacts} />
      </div>
    </div>
  );
}
