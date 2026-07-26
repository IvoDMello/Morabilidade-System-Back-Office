import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { DeleteContactButton } from "@/features/contacts/components/delete-contact-button";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { StatusBadge } from "@/features/contacts/components/status-badge";
import { FavoriteToggle } from "@/features/contacts/components/favorite-toggle";
import { ContactStageStepper } from "@/features/contacts/components/contact-stage-stepper";
import { TagPicker } from "@/features/contacts/tags/components/tag-picker";
import { PropertyPicker } from "@/features/contacts/properties/components/property-picker";
import { AiSummaryCard } from "@/features/contacts/ai/components/ai-summary-card";
import { FollowUpSuggestion } from "@/features/contacts/ai/components/follow-up-suggestion";
import { LOSS_REASON_LABELS } from "@/constants/loss-reasons";
import { NEXT_ACTION_LABELS } from "@/constants/next-actions";
import { ReminderList } from "@/features/contacts/reminders/components/reminder-list";
import { ReminderFormDialog } from "@/features/contacts/reminders/components/reminder-form-dialog";
import { ActivityFeed } from "@/features/contacts/timeline/components/activity-feed";
import { formatDateTime, formatPhone } from "@/lib/utils";
import { getContactById } from "@/services/contacts.service";
import { getNotesByContact } from "@/services/notes.service";
import { getRemindersByContact } from "@/services/reminders.service";
import { getTags, getTagsByContact } from "@/services/tags.service";
import { getEventsByContact } from "@/services/events.service";
import { getTemplates } from "@/services/templates.service";
import { getProperties, getPropertiesByContact } from "@/services/properties.service";
import { fetchImoveisByCodigos } from "@/lib/backoffice-api";
import { getConversationMessages } from "@/services/whatsapp.service";
import { createReminderAction } from "@/app/contatos/actions";

interface ContatoDetalhePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novoLembrete?: string }>;
}

export default async function ContatoDetalhePage({
  params,
  searchParams,
}: ContatoDetalhePageProps) {
  const { id } = await params;
  const { novoLembrete } = await searchParams;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const [
    notes,
    reminders,
    contactTags,
    allTags,
    messages,
    events,
    templates,
    contactProperties,
    allProperties,
  ] = await Promise.all([
    getNotesByContact(id),
    getRemindersByContact(id),
    getTagsByContact(id),
    getTags(),
    getConversationMessages(id),
    getEventsByContact(id),
    getTemplates(),
    getPropertiesByContact(id),
    getProperties(),
  ]);

  // Detalhes ao vivo dos imóveis vinculados (status/bairro/preço do catálogo
  // real). Best-effort: mapa vazio se a API não estiver configurada ou fora.
  const liveDetails = await fetchImoveisByCodigos(contactProperties.map((cp) => cp.code));

  const lastMessageAt = messages.length > 0 ? messages[messages.length - 1].waTimestamp : null;
  const lastNoteAt = notes.length > 0 ? notes[0].createdAt : null;
  const lastActivity = [contact.updatedAt, lastMessageAt, lastNoteAt]
    .filter((d): d is string => Boolean(d))
    .reduce((latest, current) => (new Date(current) > new Date(latest) ? current : latest));
  const daysSinceActivity =
    (new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
  const isInactive = daysSinceActivity >= 7 && !["finalizado", "perdido"].includes(contact.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-card px-4 py-3">
        <ContactStageStepper status={contact.status} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Painel fixo (FC-2): dados + tags + IA + lembretes + imóveis, sempre visível */}
        <div className="flex w-full flex-col gap-4 lg:sticky lg:top-6 lg:w-[340px] lg:shrink-0">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 gap-3">
                <AvatarInitials name={contact.name} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger
                        render={<h1 className="truncate font-heading text-xl font-semibold" />}
                      >
                        {contact.name}
                      </TooltipTrigger>
                      <TooltipContent>
                        Criado em {formatDateTime(contact.createdAt)}
                        <br />
                        Atualizado em {formatDateTime(contact.updatedAt)}
                      </TooltipContent>
                    </Tooltip>
                    <FavoriteToggle contactId={contact.id} isFavorite={contact.isFavorite} size="icon-sm" />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{formatPhone(contact.phone)}</p>
                  {contact.email && (
                    <p className="truncate text-sm text-muted-foreground">{contact.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={contact.category} />
              <StatusBadge status={contact.status} />
            </div>

            <p className="text-sm text-muted-foreground">
              Próxima ação: <span className="font-medium text-foreground">{NEXT_ACTION_LABELS[contact.nextAction]}</span>
            </p>

            <TagPicker contactId={contact.id} contactTags={contactTags} allTags={allTags} />

            {contact.status === "perdido" && contact.lossReason && (
              <div className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">Motivo da perda: {LOSS_REASON_LABELS[contact.lossReason]}</p>
                {contact.lossReasonNote && (
                  <p className="mt-0.5 text-destructive/80">{contact.lossReasonNote}</p>
                )}
              </div>
            )}

            {contact.generalNotes && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {contact.generalNotes}
              </p>
            )}

            <div className="flex gap-2">
              <WhatsAppButton phone={contact.phone} className="flex-1" />
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/contatos/${contact.id}/editar`} aria-label="Editar contato" />}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteContactButton contactId={contact.id} contactName={contact.name} />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo com IA</CardTitle>
            </CardHeader>
            <CardContent>
              <AiSummaryCard
                contactId={contact.id}
                summary={contact.aiSummary}
                generatedAt={contact.aiSummaryGeneratedAt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lembretes</CardTitle>
              <ReminderFormDialog
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                }
                title="Novo lembrete"
                onSubmit={createReminderAction.bind(null, contact.id)}
                defaultOpen={novoLembrete === "1"}
              />
            </CardHeader>
            <CardContent>
              <ReminderList contactId={contact.id} reminders={reminders} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imóveis</CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyPicker
                contactId={contact.id}
                contactProperties={contactProperties}
                allProperties={allProperties}
                liveDetails={liveDetails}
              />
            </CardContent>
          </Card>

          {isInactive && (
            <Card>
              <CardHeader>
                <CardTitle>Sugestão de Follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                <FollowUpSuggestion contactId={contact.id} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Atividade unificada (FC-1): mensagens + anotações + eventos, filtrável, composer fixo */}
        <div className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card p-4 lg:h-[calc(100vh-11rem)]">
          <ActivityFeed
            contactId={contact.id}
            notes={notes}
            events={events}
            messages={messages}
            templates={templates}
          />
        </div>
      </div>
    </div>
  );
}
