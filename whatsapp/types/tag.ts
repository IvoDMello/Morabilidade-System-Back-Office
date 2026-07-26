import type { TagColor } from "@/constants/tag-colors";
import type { ID } from "./common";

export interface Tag {
  id: ID;
  name: string;
  color: TagColor;
  createdAt: string;
}

export interface CreateTagInput {
  name: string;
  color?: TagColor;
}
