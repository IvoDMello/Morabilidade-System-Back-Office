import type { ID } from "@/types/common";
import type {
  Contact,
  ContactFilters,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact";
import type { ContactNote, CreateNoteInput } from "@/types/note";
import type {
  ContactReminder,
  CreateReminderInput,
  ReminderFilters,
  ReminderWithContact,
  UpdateReminderInput,
  VisitaParaFicha,
} from "@/types/reminder";
import type { CreateTagInput, Tag } from "@/types/tag";
import type { ContactEvent, CreateEventInput } from "@/types/event";
import type { CreateTemplateInput, MessageTemplate } from "@/types/template";
import type { ContactPropertyWithDetails, CreatePropertyInput, Property } from "@/types/property";
import type { PropertyStage } from "@/constants/property-stages";
import type { PropertyRelation } from "@/constants/property-relations";
import type { Corretor } from "@/types/corretor";
import type {
  CreateWhatsAppMessageInput,
  WhatsAppConversation,
  WhatsAppConversationSummary,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppMessageSearchResult,
} from "@/types/whatsapp";
import type { ConversationStatus } from "@/constants/conversation-status";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { CreatePushSubscriptionInput, PushSubscriptionRecord } from "@/types/push";
import type {
  AgentProposal,
  AgentToolScore,
  CreateAgentProposalInput,
  DecidirAgentProposalInput,
} from "@/types/agent-proposal";
import type { AgentRun, AgentRunConsumo, CreateAgentRunInput } from "@/types/agent-run";

/**
 * Contrato que toda fonte de dados (mock ou Supabase) precisa implementar.
 * A camada de services só conhece esta interface — trocar a implementação
 * é uma mudança de configuração (NEXT_PUBLIC_DATA_SOURCE), não de código.
 */
export interface DataSource {
  contacts: {
    list(filters?: ContactFilters): Promise<Contact[]>;
    getById(id: ID): Promise<Contact | null>;
    findByPhone(phone: string): Promise<Contact | null>;
    create(input: CreateContactInput): Promise<Contact>;
    update(id: ID, input: UpdateContactInput): Promise<Contact>;
    remove(id: ID): Promise<void>;
  };
  notes: {
    listByContact(contactId: ID): Promise<ContactNote[]>;
    create(input: CreateNoteInput): Promise<ContactNote>;
  };
  reminders: {
    listByContact(contactId: ID): Promise<ContactReminder[]>;
    listAll(filters?: ReminderFilters): Promise<ReminderWithContact[]>;
    create(input: CreateReminderInput): Promise<ContactReminder>;
    update(id: ID, input: UpdateReminderInput): Promise<ContactReminder>;
    remove(id: ID): Promise<void>;
    /** Visitas pendentes entre `fromIso` e `toIso` que ainda não tiveram a ficha
     * enviada — a fila do cron de ficha de visita. */
    listVisitasParaFicha(fromIso: string, toIso: string): Promise<VisitaParaFicha[]>;
  };
  tags: {
    list(): Promise<Tag[]>;
    create(input: CreateTagInput): Promise<Tag>;
    listByContact(contactId: ID): Promise<Tag[]>;
    addToContact(contactId: ID, tagId: ID): Promise<void>;
    removeFromContact(contactId: ID, tagId: ID): Promise<void>;
  };
  events: {
    listByContact(contactId: ID): Promise<ContactEvent[]>;
    create(input: CreateEventInput): Promise<ContactEvent>;
  };
  templates: {
    list(): Promise<MessageTemplate[]>;
    create(input: CreateTemplateInput): Promise<MessageTemplate>;
    remove(id: ID): Promise<void>;
  };
  properties: {
    list(): Promise<Property[]>;
    findByCode(code: string): Promise<Property | null>;
    create(input: CreatePropertyInput): Promise<Property>;
    listByContact(contactId: ID): Promise<ContactPropertyWithDetails[]>;
    addToContact(
      contactId: ID,
      propertyId: ID,
      relacao: PropertyRelation,
      stage: PropertyStage,
    ): Promise<void>;
    updateStage(contactId: ID, propertyId: ID, stage: PropertyStage): Promise<void>;
    updateRelacao(contactId: ID, propertyId: ID, relacao: PropertyRelation): Promise<void>;
    removeFromContact(contactId: ID, propertyId: ID): Promise<void>;
  };
  corretores: {
    list(): Promise<Corretor[]>;
    getByAuthUserId(authUserId: string): Promise<Corretor | null>;
  };
  whatsapp: {
    listConversations(): Promise<WhatsAppConversationSummary[]>;
    getConversationByContactId(contactId: ID): Promise<WhatsAppConversation | null>;
    getOrCreateConversationForContact(
      contactId: ID,
      waPhoneNumber: string,
    ): Promise<WhatsAppConversation>;
    listMessages(conversationId: ID): Promise<WhatsAppMessage[]>;
    searchMessages(query: string, limit?: number): Promise<WhatsAppMessageSearchResult[]>;
    createMessage(input: CreateWhatsAppMessageInput): Promise<WhatsAppMessage>;
    findMessageByWaId(waMessageId: string): Promise<WhatsAppMessage | null>;
    updateMessageStatus(
      waMessageId: string,
      status: WhatsAppMessageStatus,
      errorMessage?: string | null,
    ): Promise<WhatsAppMessage | null>;
    touchConversationOnNewMessage(
      conversationId: ID,
      preview: string,
      timestampIso: string,
      direction: WhatsAppMessageDirection,
    ): Promise<void>;
    markConversationRead(conversationId: ID): Promise<void>;
    markConversationUnread(conversationId: ID): Promise<void>;
    /** Fixa (pinnedAt = ISO) ou desafixa (null) a conversa no topo da lista. */
    setConversationPinned(conversationId: ID, pinnedAt: string | null): Promise<void>;
    clearConversation(conversationId: ID): Promise<void>;
    countUnreadConversations(): Promise<number>;
    countByStatus(status: ConversationStatus): Promise<number>;
    closeConversation(conversationId: ID): Promise<void>;
    snoozeFollowUp(conversationId: ID, untilIso: string): Promise<void>;
    /** Fase 3: transição em massa respondida -> follow_up_sugerido. Retorna quantas conversas mudaram. */
    markStaleRespondidasAsFollowUp(cutoffIso: string): Promise<number>;
    /** Fase 3: conversas aguardando resposta há mais tempo que o corte e sem alerta hoje. */
    listOverdueAwaiting(
      alertCutoffIso: string,
      todayStartIso: string,
    ): Promise<WhatsAppConversationSummary[]>;
    markAlerted(conversationId: ID, whenIso: string): Promise<void>;
    /** Guarda os bytes de uma mídia recebida no storage e devolve o caminho salvo.
     * Só existe na fonte Supabase — o mock recebe mídia como URL já hospedada. */
    uploadMedia?(path: string, data: Uint8Array, mimeType: string): Promise<string>;
    /** Baixa uma mídia do storage pelo caminho (usado pelo proxy autenticado). */
    getMediaObject?(path: string): Promise<{ data: Blob; mimeType: string } | null>;
  };
  pushSubscriptions: {
    list(): Promise<PushSubscriptionRecord[]>;
    upsert(input: CreatePushSubscriptionInput): Promise<PushSubscriptionRecord>;
    remove(endpoint: string): Promise<void>;
  };
  /** Propostas do agente: o que ele sugeriu e o que o humano decidiu.
   * Ver `types/agent-proposal.ts` e a migration 0020. */
  agentProposals: {
    /** Pendentes de um contato — o que o painel mostra ao abrir a conversa. */
    listPendentesPorContato(contactId: ID): Promise<AgentProposal[]>;
    createMany(inputs: CreateAgentProposalInput[]): Promise<AgentProposal[]>;
    decidir(id: ID, input: DecidirAgentProposalInput): Promise<void>;
    /** Marca as pendentes da conversa como `superada` (chegou coisa nova). */
    superarPendentes(conversationId: ID): Promise<number>;
    /** Dedupe da análise: esta mensagem recebida já foi analisada? */
    jaAnalisouMensagem(messageId: ID): Promise<boolean>;
    /** Placar por ferramenta — a régua de graduação de autonomia. */
    placar(): Promise<AgentToolScore[]>;
    /** Pares (sugerido, enviado) de respostas editadas — matéria-prima do VOZ.md. */
    listEdicoesRecentes(limit?: number): Promise<
      { sugerido: string; enviado: string; decididoEm: string }[]
    >;
  };
  /** Livro-razão das chamadas de modelo: mede o custo e sustenta o teto do
   * caminho automático. Ver `services/ai-budget.service.ts` e a migration 0021. */
  agentRuns: {
    registrar(input: CreateAgentRunInput): Promise<void>;
    /** Consumo das chamadas AUTOMÁTICAS (webhook/cron) desde um instante —
     * é sobre isto que o teto decide. Clique de painel não entra na conta. */
    consumoAutomaticoDesde(desdeIso: string): Promise<AgentRunConsumo>;
    listRecentes(limit?: number): Promise<AgentRun[]>;
  };
}
