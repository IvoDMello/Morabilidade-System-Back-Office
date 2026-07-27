import type { ID } from "./common";

export interface MessageTemplate {
  id: ID;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateTemplateInput {
  title: string;
  body: string;
}
