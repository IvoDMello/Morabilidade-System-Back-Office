import { addDays, setHours, setMinutes, subDays, subHours, subMinutes } from "date-fns";
import type { Contact } from "@/types/contact";
import type { ContactNote } from "@/types/note";
import type { ContactReminder } from "@/types/reminder";
import type { Tag } from "@/types/tag";
import type { ContactEvent } from "@/types/event";
import type { MessageTemplate } from "@/types/template";
import type { ContactProperty, Property } from "@/types/property";
import type { WhatsAppConversation, WhatsAppMessage } from "@/types/whatsapp";
import type { Corretor } from "@/types/corretor";
import type { ImovelDisponivel, PreferenciaBusca } from "@/types/oportunidade";

/**
 * Dados do modo mock (`NEXT_PUBLIC_DATA_SOURCE=mock`) — o painel roda inteiro
 * sem Supabase nenhum.
 *
 * ── Por que são só quatro contatos ────────────────────────────────────────
 * Eram doze, com nomes e telefones de gente plausível ("Marcos Andrade",
 * "(11) 98765-4321"). Um seed assim é uma armadilha: numa tela cheia ninguém
 * distingue o exemplo do cliente de verdade, e a dúvida "esse aqui é real?"
 * aparece justamente na hora de mandar mensagem. Os quatro que sobraram dizem no
 * nome que são exemplo e usam números impossíveis (55 11 9000-000X), então a
 * confusão não tem como acontecer.
 *
 * O que cada um cobre está no comentário do próprio contato — juntos, mantêm
 * de pé as filas que o painel precisa exercitar em desenvolvimento
 * (aguardando resposta, follow-up, visita com ficha automática).
 *
 * Para limpar os doze antigos do banco real, ver
 * supabase/migrations/0027_limpeza_contatos_demo.sql.
 */

function at(daysOffset: number, hours: number, minutes = 0): string {
  return setMinutes(setHours(addDays(new Date(), daysOffset), hours), minutes).toISOString();
}

const now = new Date();

function contact(
  partial: Pick<Contact, "id" | "name" | "phone" | "category" | "status" | "nextAction"> &
    Partial<Contact>,
): Contact {
  return {
    email: null,
    isFavorite: false,
    isBlocked: false,
    lossReason: null,
    lossReasonNote: null,
    generalNotes: null,
    aiSummary: null,
    aiSummaryGeneratedAt: null,
    clienteId: null,
    clienteCodigo: null,
    corretorId: null,
    createdAt: subDays(now, 30).toISOString(),
    updatedAt: subDays(now, 30).toISOString(),
    ...partial,
  };
}

export const seedCorretores: Corretor[] = [
  // Rodrigo já ligado a um login: é o corretor que assina as fichas geradas
  // pelo cron no modo mock (em produção esse vínculo vem do auth_user_id).
  { id: "co1", nome: "Rodrigo", authUserId: "auth-mock-rodrigo", cor: "blue", ativo: true, createdAt: subDays(now, 60).toISOString() },
  { id: "co2", nome: "Leandro", authUserId: null, cor: "emerald", ativo: true, createdAt: subDays(now, 60).toISOString() },
  { id: "co3", nome: "Ivo", authUserId: null, cor: "violet", ativo: true, createdAt: subDays(now, 60).toISOString() },
];

export const seedContacts: Contact[] = [
  contact({
    // Comprador com perfil de busca preenchido: é o contato que faz a aba de
    // Oportunidades ter o que mostrar, e o que tem visita com ficha automática.
    id: "c1",
    name: "Exemplo — Comprador",
    phone: "5511900000001",
    email: "exemplo.comprador@morabilidade.test",
    category: "comprador",
    status: "visita_marcada",
    nextAction: "agendar_visita",
    isFavorite: true,
    generalNotes: "Contato de exemplo do modo mock — não é cliente real.",
    clienteId: "cli-exemplo-1",
    clienteCodigo: "CL-90001",
    updatedAt: subMinutes(now, 20).toISOString(),
  }),
  contact({
    // Proprietário: cobre a fila "aguardando resposta" e a categoria que não
    // procura imóvel (a aba de Oportunidades precisa lidar com esse caso).
    id: "c2",
    name: "Exemplo — Proprietário",
    phone: "5511900000002",
    category: "proprietario",
    status: "em_atendimento",
    nextAction: "ligar",
    generalNotes: "Contato de exemplo do modo mock — não é cliente real.",
    updatedAt: subHours(now, 26).toISOString(),
  }),
  contact({
    // Locatário: cobre follow-up esfriando e visita sem imóvel vinculado.
    id: "c3",
    name: "Exemplo — Locatário",
    phone: "5511900000003",
    category: "locatario",
    status: "documentacao",
    nextAction: "enviar_documentacao",
    generalNotes: "Contato de exemplo do modo mock — não é cliente real.",
    clienteId: "cli-exemplo-3",
    clienteCodigo: "CL-90003",
    updatedAt: subDays(now, 4).toISOString(),
  }),
  contact({
    // Investidor: a SEGUNDA conversa aguardando resposta, e recente.
    // Duas são necessárias, não decoração: o alerta horário separa quem espera
    // há mais de 2h de quem acabou de escrever, e a triagem da IA precisa
    // sempre de uma conversa ainda não triada para ter o que ler.
    id: "c4",
    name: "Exemplo — Investidor",
    phone: "5511900000004",
    category: "investidor",
    status: "novo",
    nextAction: "ligar",
    generalNotes: "Contato de exemplo do modo mock — não é cliente real.",
    updatedAt: subMinutes(now, 45).toISOString(),
  }),
];

export const seedNotes: ContactNote[] = [
  {
    id: "n1",
    contactId: "c1",
    note: "Visita ao MB-00033 marcada; cliente pediu para ver mais opções no mesmo bairro.",
    createdBy: "Ana Valadares",
    createdAt: subDays(now, 1).toISOString(),
  },
  {
    id: "n2",
    contactId: "c2",
    note: "Perguntou sobre reajuste do aluguel — aguardando retorno do proprietário.",
    createdBy: "Ana Valadares",
    createdAt: subHours(now, 26).toISOString(),
  },
  {
    id: "n3",
    contactId: "c3",
    note: "Solicitado comprovante de renda dos últimos 3 meses.",
    createdBy: "Bruno Castro",
    createdAt: subDays(now, 2).toISOString(),
  },
];

// corretorId e os campos de ficha são preenchidos no export abaixo (o seed não
// atribui corretor nem tem visita com ficha gerada).
const seedRemindersData: Omit<
  ContactReminder,
  "corretorId" | "imovelCodigo" | "fichaVisitaId" | "fichaNotificadaEm" | "googleCalendarEventId"
>[] = [
  {
    // Vencido: alimenta o selo vermelho de Pendências.
    id: "r1",
    contactId: "c2",
    title: "Cobrar retorno sobre o reajuste",
    description: "Confirmar se o proprietário aceita o novo valor proposto.",
    reminderAt: at(-1, 15, 30),
    status: "pendente",
    createdBy: "Ana Valadares",
    createdAt: subDays(now, 3).toISOString(),
    updatedAt: subDays(now, 3).toISOString(),
  },
  {
    // Para hoje.
    id: "r2",
    contactId: "c1",
    title: "Confirmar horário da visita",
    description: null,
    reminderAt: at(0, 14),
    status: "pendente",
    createdBy: "Bruno Castro",
    createdAt: subDays(now, 1).toISOString(),
    updatedAt: subDays(now, 1).toISOString(),
  },
  {
    // Futuro.
    id: "r3",
    contactId: "c3",
    title: "Prazo final para envio da documentação",
    description: null,
    reminderAt: at(5, 18),
    status: "pendente",
    createdBy: "Ana Valadares",
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subDays(now, 2).toISOString(),
  },
  {
    // Concluído — o agrupamento da tela de lembretes precisa de um.
    id: "r4",
    contactId: "c3",
    title: "Enviar contrato para leitura",
    description: null,
    reminderAt: subDays(now, 8).toISOString(),
    status: "concluido",
    createdBy: "Bruno Castro",
    createdAt: subDays(now, 10).toISOString(),
    updatedAt: subDays(now, 8).toISOString(),
  },
];

/**
 * Cenários da ficha de visita automática (cron /api/cron/visita-fichas).
 * Ficam fora do array acima porque precisam de horário RELATIVO ao agora e de
 * campos próprios — são o roteiro de simulação: rodando o cron no modo mock,
 * cada um destes cai num ramo diferente da regra de entrega, e a resposta do
 * cron traz o texto que cada número receberia (campo `previa`).
 */
const minutosAdiante = (min: number): string =>
  new Date(now.getTime() + min * 60 * 1000).toISOString();

const seedVisitasFicha: ContactReminder[] = [
  {
    // Caminho feliz: imóvel vinculado + corretor responsável.
    id: "rv1",
    contactId: "c1",
    title: "Visita — MB-00033",
    description: "Primeira visita ao apartamento.",
    reminderAt: minutosAdiante(60),
    status: "pendente",
    createdBy: "Ana Valadares",
    corretorId: "co1", // Rodrigo
    imovelCodigo: "MB-00033",
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subDays(now, 2).toISOString(),
  },
  {
    // Sem imóvel vinculado: o cron não tem como gerar a ficha → pendência.
    id: "rv2",
    contactId: "c3",
    title: "Visita com o locatário",
    description: null,
    reminderAt: minutosAdiante(75),
    status: "pendente",
    createdBy: "Ana Valadares",
    corretorId: "co2", // Leandro
    imovelCodigo: null,
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
    createdAt: subDays(now, 1).toISOString(),
    updatedAt: subDays(now, 1).toISOString(),
  },
  {
    // Código só no título (visita criada antes da migration 0019): o cron
    // extrai "MB-00021" do texto — é o fallback de compatibilidade.
    id: "rv3",
    contactId: "c2",
    title: "Visita — MB-00021",
    description: null,
    reminderAt: minutosAdiante(85),
    status: "pendente",
    createdBy: "Bruno Castro",
    corretorId: null, // sem responsável → exercita FICHA_CORRETOR_PADRAO
    imovelCodigo: null,
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
    createdAt: subDays(now, 3).toISOString(),
    updatedAt: subDays(now, 3).toISOString(),
  },
  {
    // Fora da janela de 90 min: NÃO deve ser tocada nesta rodada.
    id: "rv4",
    contactId: "c1",
    title: "Visita — MB-00099",
    description: "Só amanhã de manhã.",
    reminderAt: minutosAdiante(300),
    status: "pendente",
    createdBy: "Ana Valadares",
    corretorId: "co1",
    imovelCodigo: "MB-00099",
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
    createdAt: subDays(now, 1).toISOString(),
    updatedAt: subDays(now, 1).toISOString(),
  },
];

export const seedReminders: ContactReminder[] = [
  ...seedRemindersData.map((r) => ({
    ...r,
    corretorId: null,
    imovelCodigo: null,
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
  })),
  ...seedVisitasFicha,
];

export const seedTags: Tag[] = [
  { id: "t1", name: "Urgente", color: "amber", createdAt: subDays(now, 20).toISOString() },
  { id: "t2", name: "VIP", color: "violet", createdAt: subDays(now, 20).toISOString() },
  { id: "t3", name: "Financiamento", color: "blue", createdAt: subDays(now, 20).toISOString() },
  // Listas padrão do filtro do inbox (espelham a migration 0008).
  { id: "t4", name: "Proprietários", color: "slate", createdAt: subDays(now, 20).toISOString() },
  { id: "t5", name: "Corretores", color: "blue", createdAt: subDays(now, 20).toISOString() },
  { id: "t6", name: "Pós venda", color: "emerald", createdAt: subDays(now, 20).toISOString() },
  { id: "t7", name: "Locatário", color: "amber", createdAt: subDays(now, 20).toISOString() },
  { id: "t8", name: "Captação", color: "pink", createdAt: subDays(now, 20).toISOString() },
  { id: "t9", name: "Singularidade", color: "violet", createdAt: subDays(now, 20).toISOString() },
  { id: "t10", name: "Morabilidade", color: "emerald", createdAt: subDays(now, 20).toISOString() },
  { id: "t11", name: "Investidor", color: "blue", createdAt: subDays(now, 20).toISOString() },
];

export const seedContactTags: { contactId: string; tagId: string }[] = [
  { contactId: "c1", tagId: "t2" },
  { contactId: "c3", tagId: "t3" },
];

export const seedConversations: WhatsAppConversation[] = [
  {
    // Respondida e recente: a janela de 24h está aberta, então a aba de
    // Oportunidades pode enviar sem aviso de bloqueio.
    id: "wc1",
    contactId: "c1",
    waPhoneNumber: "5511900000001",
    lastMessageAt: subMinutes(now, 20).toISOString(),
    lastMessagePreview: "Perfeito, te aviso assim que confirmar com o proprietário!",
    lastMessageDirection: "outbound",
    unreadCount: 0,
    status: "respondida",
    lastInboundAt: subMinutes(now, 25).toISOString(),
    lastOutboundAt: subMinutes(now, 20).toISOString(),
    statusChangedAt: subMinutes(now, 20).toISOString(),
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    triagemPrecisaResposta: null,
    triagemMotivo: null,
    triagemMensagemEm: null,
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subMinutes(now, 20).toISOString(),
  },
  {
    // Aguardando resposta há mais de 24h: alimenta a fila de Pendências e o
    // aviso de janela fechada na aba de Oportunidades.
    id: "wc2",
    contactId: "c2",
    waPhoneNumber: "5511900000002",
    lastMessageAt: subHours(now, 26).toISOString(),
    lastMessagePreview: "Consegue me confirmar o valor atualizado do aluguel?",
    lastMessageDirection: "inbound",
    unreadCount: 1,
    status: "aguardando_resposta",
    lastInboundAt: subHours(now, 26).toISOString(),
    lastOutboundAt: subDays(now, 5).toISOString(),
    statusChangedAt: subHours(now, 26).toISOString(),
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    triagemPrecisaResposta: null,
    triagemMotivo: null,
    triagemMensagemEm: null,
    createdAt: subDays(now, 10).toISOString(),
    updatedAt: subHours(now, 26).toISOString(),
  },
  {
    // Esfriando: `respondida` com último inbound há 4 dias — o job da Fase 3
    // deve promovê-la a follow_up_sugerido quando rodar.
    id: "wc3",
    contactId: "c3",
    waPhoneNumber: "5511900000003",
    lastMessageAt: subDays(now, 3).toISOString(),
    lastMessagePreview: "Tudo bem, vou providenciar e te aviso!",
    lastMessageDirection: "outbound",
    unreadCount: 0,
    status: "respondida",
    lastInboundAt: subDays(now, 4).toISOString(),
    lastOutboundAt: subDays(now, 3).toISOString(),
    statusChangedAt: subDays(now, 3).toISOString(),
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    triagemPrecisaResposta: null,
    triagemMotivo: null,
    triagemMensagemEm: null,
    createdAt: subDays(now, 12).toISOString(),
    updatedAt: subDays(now, 3).toISOString(),
  },
  {
    // Aguardando resposta há 45 min: abaixo do corte de 2h do alerta horário,
    // então esta NÃO deve gerar alerta enquanto a wc2 (26h) deve.
    id: "wc4",
    contactId: "c4",
    waPhoneNumber: "5511900000004",
    lastMessageAt: subMinutes(now, 45).toISOString(),
    lastMessagePreview: "Oi, alguma novidade sobre a proposta?",
    lastMessageDirection: "inbound",
    unreadCount: 1,
    status: "aguardando_resposta",
    lastInboundAt: subMinutes(now, 45).toISOString(),
    lastOutboundAt: subDays(now, 2).toISOString(),
    statusChangedAt: subMinutes(now, 45).toISOString(),
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    triagemPrecisaResposta: null,
    triagemMotivo: null,
    triagemMensagemEm: null,
    createdAt: subDays(now, 8).toISOString(),
    updatedAt: subMinutes(now, 45).toISOString(),
  },
];

export const seedEvents: ContactEvent[] = [
  {
    id: "ev1",
    contactId: "c1",
    type: "contact_created",
    summary: "Contato criado",
    createdAt: subDays(now, 30).toISOString(),
  },
  {
    id: "ev2",
    contactId: "c1",
    type: "property_linked",
    summary: "Imóvel MB-00033 vinculado pela mensagem do cliente",
    createdAt: subDays(now, 2).toISOString(),
  },
  {
    id: "ev3",
    contactId: "c1",
    type: "status_changed",
    summary: "Status alterado para Visita marcada",
    createdAt: subDays(now, 2).toISOString(),
  },
  {
    id: "ev4",
    contactId: "c2",
    type: "contact_created",
    summary: "Contato criado",
    createdAt: subDays(now, 30).toISOString(),
  },
  {
    id: "ev5",
    contactId: "c2",
    type: "status_changed",
    summary: "Status alterado para Em atendimento",
    createdAt: subDays(now, 25).toISOString(),
  },
  {
    id: "ev6",
    contactId: "c3",
    type: "contact_created",
    summary: "Contato criado",
    createdAt: subDays(now, 30).toISOString(),
  },
  {
    id: "ev7",
    contactId: "c3",
    type: "tag_added",
    summary: "Etiqueta \"Financiamento\" adicionada",
    createdAt: subDays(now, 20).toISOString(),
  },
];

export const seedTemplates: MessageTemplate[] = [
  {
    id: "tpl1",
    title: "Fotos do imóvel",
    body: "Segue em anexo as fotos do imóvel! Qualquer dúvida, estou à disposição.",
    createdAt: subDays(now, 20).toISOString(),
  },
  {
    id: "tpl2",
    title: "Localização",
    body: "Aqui está a localização do imóvel: [inserir link do Google Maps]",
    createdAt: subDays(now, 20).toISOString(),
  },
  {
    id: "tpl3",
    title: "Agendar visita",
    body: "Podemos agendar uma visita? Tenho disponibilidade nos seguintes horários: ...",
    createdAt: subDays(now, 20).toISOString(),
  },
  {
    id: "tpl4",
    title: "Solicitar documentos",
    body: "Para darmos continuidade, preciso que você envie os seguintes documentos: RG, CPF e comprovante de renda.",
    createdAt: subDays(now, 20).toISOString(),
  },
];

export const seedProperties: Property[] = [
  {
    id: "p1",
    code: "MB-00033",
    title: "Cobertura em Ipanema",
    createdAt: subDays(now, 25).toISOString(),
  },
  {
    id: "p2",
    code: "MB-00020",
    title: "Casa de vila no Jardim Botânico",
    createdAt: subDays(now, 25).toISOString(),
  },
];

// relacao preenchido no export abaixo (todos os vínculos seed são de interesse).
const seedContactPropertiesData: Omit<ContactProperty, "relacao">[] = [
  {
    contactId: "c1",
    propertyId: "p1",
    stage: "visita",
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subDays(now, 1).toISOString(),
  },
];

export const seedContactProperties: ContactProperty[] = seedContactPropertiesData.map((cp) => ({
  ...cp,
  relacao: "interesse" as const,
}));

export const seedMessages: WhatsAppMessage[] = [
  {
    id: "wm1",
    conversationId: "wc1",
    waMessageId: "mock-seed-1",
    direction: "inbound",
    messageType: "text",
    body: "Olá! Tenho interesse no imóvel *Cobertura em Ipanema* (código *MB-00033*).",
    status: "received",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: null,
    waTimestamp: subHours(now, 1).toISOString(),
    createdAt: subHours(now, 1).toISOString(),
  },
  {
    id: "wm2",
    conversationId: "wc1",
    waMessageId: "mock-seed-2",
    direction: "outbound",
    messageType: "text",
    body: "Olá! Sim, ainda está disponível. Posso agendar uma visita essa semana?",
    status: "read",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: "Ana Valadares",
    waTimestamp: subMinutes(now, 40).toISOString(),
    createdAt: subMinutes(now, 40).toISOString(),
  },
  {
    id: "wm3",
    conversationId: "wc1",
    waMessageId: "mock-seed-3",
    direction: "inbound",
    messageType: "text",
    body: "Perfeito! Quinta à tarde funciona pra mim.",
    status: "received",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: null,
    waTimestamp: subMinutes(now, 25).toISOString(),
    createdAt: subMinutes(now, 25).toISOString(),
  },
  {
    id: "wm4",
    conversationId: "wc1",
    waMessageId: "mock-seed-4",
    direction: "outbound",
    messageType: "text",
    body: "Perfeito, te aviso assim que confirmar com o proprietário!",
    status: "delivered",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: "Ana Valadares",
    waTimestamp: subMinutes(now, 20).toISOString(),
    createdAt: subMinutes(now, 20).toISOString(),
  },
  {
    id: "wm5",
    conversationId: "wc2",
    waMessageId: "mock-seed-5",
    direction: "inbound",
    messageType: "text",
    body: "Consegue me confirmar o valor atualizado do aluguel?",
    status: "received",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: null,
    waTimestamp: subHours(now, 26).toISOString(),
    createdAt: subHours(now, 26).toISOString(),
  },
  {
    id: "wm6",
    conversationId: "wc3",
    waMessageId: "mock-seed-6",
    direction: "outbound",
    messageType: "text",
    body: "Tudo bem, vou providenciar e te aviso!",
    status: "read",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: "Ana Valadares",
    waTimestamp: subDays(now, 3).toISOString(),
    createdAt: subDays(now, 3).toISOString(),
  },
  {
    id: "wm7",
    conversationId: "wc4",
    waMessageId: "mock-seed-7",
    direction: "inbound",
    messageType: "text",
    body: "Oi, alguma novidade sobre a proposta?",
    status: "received",
    errorMessage: null,
    replyTo: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    createdBy: null,
    waTimestamp: subMinutes(now, 45).toISOString(),
    createdAt: subMinutes(now, 45).toISOString(),
  },
];

/**
 * Catálogo de imóveis de mentira para a aba de Oportunidades rodar sem o
 * Supabase do sistema (`public.imoveis`). Os valores respeitam o piso de
 * R$ 2M das oportunidades — abaixo dele o imóvel nem entraria na lista, e um
 * catálogo mock que some inteiro não ensina nada sobre a tela.
 */
export const seedImoveisSistema: ImovelDisponivel[] = [
  {
    id: "im1",
    codigo: "MB-00033",
    titulo: "Cobertura em Ipanema",
    cidade: "Rio de Janeiro",
    bairro: "Ipanema",
    tipoImovel: "cobertura",
    tipoNegocio: "venda",
    andar: 8,
    valorVenda: 4_200_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 2,
    fotoCapa: null,
  },
  {
    id: "im2",
    codigo: "MB-00041",
    titulo: "Apartamento reformado no Leblon",
    cidade: "Rio de Janeiro",
    bairro: "Leblon",
    tipoImovel: "apartamento",
    tipoNegocio: "venda",
    andar: 4,
    valorVenda: 2_950_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 1,
    fotoCapa: null,
  },
  {
    // "Quase": bate tudo menos as vagas — é o caso que a aba usa para mostrar
    // o que falta em vez de simplesmente esconder o imóvel.
    id: "im3",
    codigo: "MB-00052",
    titulo: "Apartamento térreo com jardim em Ipanema",
    cidade: "Rio de Janeiro",
    bairro: "Ipanema",
    tipoImovel: "apartamento",
    tipoNegocio: "venda",
    andar: 1,
    valorVenda: 2_400_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 0,
    fotoCapa: null,
  },
  {
    id: "im4",
    codigo: "MB-00060",
    titulo: "Casa de vila no Jardim Botânico",
    cidade: "Rio de Janeiro",
    bairro: "Jardim Botânico",
    tipoImovel: "casa_vila",
    tipoNegocio: "ambos",
    andar: null,
    valorVenda: 3_100_000,
    valorLocacao: 12_000,
    dormitorios: 4,
    vagasGaragem: 2,
    fotoCapa: null,
  },
  {
    id: "im5",
    codigo: "MB-00071",
    titulo: "Apartamento para locação em Botafogo",
    cidade: "Rio de Janeiro",
    bairro: "Botafogo",
    tipoImovel: "apartamento",
    tipoNegocio: "locacao",
    andar: 6,
    valorVenda: null,
    valorLocacao: 6_500,
    dormitorios: 2,
    vagasGaragem: 1,
    fotoCapa: null,
  },
];

/** Perfis de busca de mentira, chaveados pelos `clienteId` dos contatos acima. */
export const seedPreferencias: PreferenciaBusca[] = [
  {
    clienteId: "cli-exemplo-1",
    tipoNegocio: "venda",
    tipoImovel: "apartamento",
    cidade: "Rio de Janeiro",
    bairros: ["Ipanema", "Leblon"],
    valorMin: null,
    valorMax: 3_000_000,
    dormitoriosMin: 3,
    vagasGaragemMin: 1,
    observacoes: "Prefere andar alto; aceita térreo se tiver jardim.",
    origem: "manual",
    atualizadaEm: subDays(now, 2).toISOString(),
  },
  {
    clienteId: "cli-exemplo-3",
    tipoNegocio: "locacao",
    tipoImovel: null,
    cidade: "Rio de Janeiro",
    bairros: [],
    valorMin: null,
    valorMax: 8_000,
    dormitoriosMin: 2,
    vagasGaragemMin: null,
    observacoes: null,
    origem: "manual",
    atualizadaEm: subDays(now, 4).toISOString(),
  },
];
