import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { FieldRow } from "@/components/shared/field-row";
import { DeleteContactButton } from "@/features/contacts/components/delete-contact-button";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { StatusBadge } from "@/features/contacts/components/status-badge";
import { FavoriteToggle } from "@/features/contacts/components/favorite-toggle";
import { TagPicker } from "@/features/contacts/tags/components/tag-picker";
import { CorretorPicker } from "@/features/contacts/components/corretor-picker";
import { PropertyPicker } from "@/features/contacts/properties/components/property-picker";
import { AiSummaryCard } from "@/features/contacts/ai/components/ai-summary-card";
import { FollowUpSuggestion } from "@/features/contacts/ai/components/follow-up-suggestion";
import { LOSS_REASON_LABELS } from "@/constants/loss-reasons";
import { ReminderList } from "@/features/contacts/reminders/components/reminder-list";
import { ReminderFormDialog } from "@/features/contacts/reminders/components/reminder-form-dialog";
import { ActivityFeed } from "@/features/contacts/timeline/components/activity-feed";
import { ContactPanels } from "@/features/contacts/components/contact-panels";
import { formatDateTime, formatPhone } from "@/lib/utils";
import { ensureClienteVinculo, getContactById } from "@/services/contacts.service";
import { getNotesByContact } from "@/services/notes.service";
import { getRemindersByContact } from "@/services/reminders.service";
import { getTags, getTagsByContact } from "@/services/tags.service";
import { getEventsByContact } from "@/services/events.service";
import { getProperties, getPropertiesByContact } from "@/services/properties.service";
import { getCorretores } from "@/services/corretores.service";
import { fetchDossieCliente, fetchImoveisByCodigos } from "@/lib/backoffice-api";
import { DossieCard, temConteudo } from "@/features/contacts/dossie/components/dossie-card";
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
  const contactRaw = await getContactById(id);
  if (!contactRaw) notFound();

  // Casa o contato com o cliente real do sistema por telefone (best-effort;
  // idempotente — só busca enquanto não vinculado).
  const contact = await ensureClienteVinculo(contactRaw);

  const [
    notes,
    reminders,
    contactTags,
    allTags,
    messages,
    events,
    contactProperties,
    allProperties,
    corretores,
  ] = await Promise.all([
    getNotesByContact(id),
    getRemindersByContact(id),
    getTagsByContact(id),
    getTags(),
    getConversationMessages(id),
    getEventsByContact(id),
    getPropertiesByContact(id),
    getProperties(),
    getCorretores(),
  ]);

  // Detalhes ao vivo dos imóveis vinculados (status/bairro/preço do catálogo
  // real) e o dossiê do cliente no sistema principal (visitas, imóveis
  // próprios, documentos). Ambos best-effort: sem a API configurada, um vira
  // mapa vazio e o outro null, e a ficha continua inteira.
  const [liveDetails, dossie] = await Promise.all([
    fetchImoveisByCodigos(contactProperties.map((cp) => cp.code)),
    contact.clienteId ? fetchDossieCliente(contact.clienteId) : Promise.resolve(null),
  ]);

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
      {/* Painel (FC-2) e atividade (FC-1): lado a lado no desktop, duas abas no
          celular — ver ContactPanels. */}
      <ContactPanels
        dados={
          <>
            <Card>
              <CardContent className="flex flex-col gap-3">
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
                    {/* Telefone em jade, como na lista: é o dado que se procura
                        com o olho na ficha inteira, e em cinza ele desaparecia. */}
                    <p className="truncate text-sm font-medium tabular-nums text-jade">
                      {formatPhone(contact.phone)}
                    </p>
                    {contact.clienteCodigo && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <BadgeCheck className="h-3 w-3" />
                        Cliente {contact.clienteCodigo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={contact.category} />
                  <StatusBadge status={contact.status} />
                </div>

                <FieldRow label="Responsável">
                  <CorretorPicker
                    contactId={contact.id}
                    corretorId={contact.corretorId}
                    corretores={corretores}
                  />
                </FieldRow>

                <FieldRow label="Etiquetas">
                  <TagPicker contactId={contact.id} contactTags={contactTags} allTags={allTags} />
                </FieldRow>

                {contact.status === "perdido" && contact.lossReason && (
                  <div className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
                    <p className="font-medium">Motivo da perda: {LOSS_REASON_LABELS[contact.lossReason]}</p>
                    {contact.lossReasonNote && (
                      <p className="mt-0.5 text-destructive/80">{contact.lossReasonNote}</p>
                    )}
                  </div>
                )}

                {/* Observação em caixa, não em texto solto: sem moldura ela
                    passava por legenda do que estava acima. */}
                {contact.generalNotes && (
                  <p className="rounded-xl bg-well px-3 py-2.5 text-sm whitespace-pre-wrap text-ink-mid">
                    {contact.generalNotes}
                  </p>
                )}

                <div className="flex gap-2">
                  <WhatsAppButton phone={contact.phone} className="flex-1" />
                  <Button
                    variant="outline"
                    size="icon"
                    nativeButton={false}
                    render={
                      <Link href={`/contatos/${contact.id}/editar`} aria-label="Editar contato" />
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteContactButton contactId={contact.id} contactName={contact.name} />
                </div>
              </CardContent>
            </Card>

            {/* Um cartão de IA, não dois. Resumo e follow-up são perguntas
                diferentes ("quem é este contato" e "o que dizer agora"), então
                ambos ficam — mas como seções do mesmo bloco: dois cartões com o
                mesmo ícone disputavam a atenção sem que a diferença aparecesse. */}
            <Card>
              <CardHeader>
                <CardTitle>Assistente</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Resumo do contato
                  </h3>
                  <AiSummaryCard
                    contactId={contact.id}
                    summary={contact.aiSummary}
                    generatedAt={contact.aiSummaryGeneratedAt}
                  />
                </section>

                {isInactive && (
                  <section className="flex flex-col gap-2 border-t pt-4">
                    <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                      Retomar o contato
                    </h3>
                    <FollowUpSuggestion contactId={contact.id} />
                  </section>
                )}
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

            {/* O que o sistema principal sabe. Vem antes dos imóveis do CRM
                porque é fato consumado (visita assinada, imóvel no nome dele),
                enquanto o cartão abaixo é o interesse que a equipe anotou. */}
            {temConteudo(dossie) && <DossieCard dossie={dossie} />}

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
          </>
        }
        atividade={
          /* Atividade unificada (FC-1): mensagens + anotações + eventos,
             filtrável, com o composer fixo no rodapé. */
          <ActivityFeed
            contactId={contact.id}
            notes={notes}
            events={events}
            messages={messages}
          />
        }
      />
    </div>
  );
}
