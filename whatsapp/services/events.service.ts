import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type { CreateEventInput } from "@/types/event";

export function getEventsByContact(contactId: ID) {
  return dataSource.events.listByContact(contactId);
}

export function logEvent(input: CreateEventInput) {
  return dataSource.events.create(input);
}
