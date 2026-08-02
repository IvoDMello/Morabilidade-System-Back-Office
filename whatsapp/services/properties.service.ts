import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type { CreatePropertyInput } from "@/types/property";
import type { PropertyStage } from "@/constants/property-stages";
import type { PropertyRelation } from "@/constants/property-relations";

export function getProperties() {
  return dataSource.properties.list();
}

export function getPropertiesByContact(contactId: ID) {
  return dataSource.properties.listByContact(contactId);
}

export function findPropertyByCode(code: string) {
  return dataSource.properties.findByCode(code);
}

export function createProperty(input: CreatePropertyInput) {
  return dataSource.properties.create(input);
}

export function linkPropertyToContact(
  contactId: ID,
  propertyId: ID,
  relacao: PropertyRelation,
  stage: PropertyStage,
) {
  return dataSource.properties.addToContact(contactId, propertyId, relacao, stage);
}

export function updateContactPropertyStage(contactId: ID, propertyId: ID, stage: PropertyStage) {
  return dataSource.properties.updateStage(contactId, propertyId, stage);
}

export function updateContactPropertyRelacao(
  contactId: ID,
  propertyId: ID,
  relacao: PropertyRelation,
) {
  return dataSource.properties.updateRelacao(contactId, propertyId, relacao);
}

export function unlinkPropertyFromContact(contactId: ID, propertyId: ID) {
  return dataSource.properties.removeFromContact(contactId, propertyId);
}
