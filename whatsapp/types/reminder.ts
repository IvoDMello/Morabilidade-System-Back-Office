import type { ReminderStatus } from "@/constants/reminder-status";
import type { ID } from "./common";

export interface ContactReminder {
  id: ID;
  contactId: ID;
  title: string;
  description: string | null;
  reminderAt: string;
  status: ReminderStatus;
  createdBy: string;
  /** Corretor responsável por executar a visita/tarefa; null se não atribuído. */
  corretorId: string | null;
  /** Código do imóvel da visita (ex.: MB-00033); null em lembretes comuns. */
  imovelCodigo: string | null;
  /** Ficha de visita já gerada na API principal para esta visita; null se ainda não. */
  fichaVisitaId: string | null;
  /** Quando o link da ficha foi enviado (cliente ou pendência) — dedupe do cron. */
  fichaNotificadaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lembrete com dados do contato embutidos, usado na Central de Lembretes e no Dashboard. */
export interface ReminderWithContact extends ContactReminder {
  contactName: string;
  contactPhone: string;
}

export interface CreateReminderInput {
  contactId: ID;
  title: string;
  description?: string | null;
  reminderAt: string;
  createdBy: string;
  corretorId?: string | null;
  imovelCodigo?: string | null;
}

/** Visita elegível à ficha automática, já com o que o cron precisa para
 * gerar o documento e mandar o link (ver services/ficha-visita.service.ts). */
export interface VisitaParaFicha {
  reminderId: ID;
  reminderAt: string;
  contactId: ID;
  contactName: string;
  contactPhone: string;
  /** Cliente do sistema principal casado por telefone; null se o contato não é cliente ainda. */
  clienteId: string | null;
  imovelCodigo: string | null;
  /** Título do lembrete — fallback para extrair o código de visitas antigas. */
  title: string;
  fichaVisitaId: string | null;
  /** auth_user_id do corretor responsável = id do usuário na API principal. */
  corretorAuthUserId: string | null;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string | null;
  reminderAt?: string;
  status?: ReminderStatus;
  imovelCodigo?: string | null;
  fichaVisitaId?: string | null;
  fichaNotificadaEm?: string | null;
}

export interface ReminderFilters {
  date?: string;
  contactId?: ID;
  status?: ReminderStatus;
}
