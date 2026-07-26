import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type { CreateTemplateInput } from "@/types/template";

export function getTemplates() {
  return dataSource.templates.list();
}

export function createTemplate(input: CreateTemplateInput) {
  return dataSource.templates.create(input);
}

export function deleteTemplate(id: ID) {
  return dataSource.templates.remove(id);
}
