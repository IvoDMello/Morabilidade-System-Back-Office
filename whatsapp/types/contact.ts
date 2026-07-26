import type { ContactCategory } from "@/constants/contact-categories";
import type { ContactStatus } from "@/constants/contact-status";
import type { NextAction } from "@/constants/next-actions";
import type { LossReason } from "@/constants/loss-reasons";
import type { ContactAiSummary } from "./ai-summary";
import type { ID } from "./common";

export interface Contact {
  id: ID;
  name: string;
  phone: string;
  email: string | null;
  category: ContactCategory;
  status: ContactStatus;
  nextAction: NextAction;
  isFavorite: boolean;
  isBlocked: boolean;
  lossReason: LossReason | null;
  lossReasonNote: string | null;
  generalNotes: string | null;
  aiSummary: ContactAiSummary | null;
  aiSummaryGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string | null;
  category: ContactCategory;
  status: ContactStatus;
  nextAction: NextAction;
  isFavorite?: boolean;
  isBlocked?: boolean;
  lossReason?: LossReason | null;
  lossReasonNote?: string | null;
  generalNotes?: string | null;
  aiSummary?: ContactAiSummary | null;
  aiSummaryGeneratedAt?: string | null;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export interface ContactFilters {
  search?: string;
  category?: ContactCategory;
  status?: ContactStatus;
  nextAction?: NextAction;
  isFavorite?: boolean;
  hasReminders?: boolean;
  propertyId?: ID;
  sortBy?: "updatedAt" | "createdAt" | "name";
  sortDir?: "asc" | "desc";
}
