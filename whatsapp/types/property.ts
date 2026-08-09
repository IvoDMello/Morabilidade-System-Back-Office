import type { PropertyStage } from "@/constants/property-stages";
import type { PropertyRelation } from "@/constants/property-relations";
import type { ID } from "./common";

export interface Property {
  id: ID;
  code: string;
  title: string | null;
  createdAt: string;
}

export interface CreatePropertyInput {
  code: string;
  title?: string | null;
}

/** Vínculo contato-imóvel com o papel e a etapa atual (não é histórico — ver ContactEvent). */
export interface ContactProperty {
  contactId: ID;
  propertyId: ID;
  /** Papel do contato no imóvel (proprietário/interesse/visitado). */
  relacao: PropertyRelation;
  stage: PropertyStage;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPropertyWithDetails extends ContactProperty {
  code: string;
  title: string | null;
}
