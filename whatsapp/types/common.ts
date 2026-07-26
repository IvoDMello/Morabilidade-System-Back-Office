export type ID = string;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
