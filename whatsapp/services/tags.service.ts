import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type { CreateTagInput } from "@/types/tag";

export function getTags() {
  return dataSource.tags.list();
}

export function getTagsByContact(contactId: ID) {
  return dataSource.tags.listByContact(contactId);
}

export function createTag(input: CreateTagInput) {
  return dataSource.tags.create(input);
}

export function addTagToContact(contactId: ID, tagId: ID) {
  return dataSource.tags.addToContact(contactId, tagId);
}

export function removeTagFromContact(contactId: ID, tagId: ID) {
  return dataSource.tags.removeFromContact(contactId, tagId);
}
