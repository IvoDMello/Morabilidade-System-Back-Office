import type { DataSource } from "./types";
import { mockDataSource } from "./mock";
import { supabaseDataSource } from "./supabase";

/**
 * Fonte de dados ativa. Controlada por NEXT_PUBLIC_DATA_SOURCE ("mock" | "supabase").
 * Padrão "mock" para permitir rodar o painel sem configurar Supabase.
 * Ver README.md para instruções de como conectar ao Supabase.
 */
export const dataSource: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? supabaseDataSource : mockDataSource;
