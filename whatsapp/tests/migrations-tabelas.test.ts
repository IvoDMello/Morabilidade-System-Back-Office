import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * As migrations só são executadas à mão, no SQL Editor do Supabase — o erro
 * aparece na cara de quem cola, e não no CI. A 0026 nasceu falando de
 * `conversations` quando a tabela se chama `whatsapp_conversations`, e isso só
 * apareceu na hora de rodar em produção.
 *
 * Este teste lê os arquivos como texto e cobra uma coisa só: toda tabela citada
 * em `alter table` / `create index on` precisa ter sido criada por alguma
 * migration anterior (ou pela própria). É análise de string, não um banco —
 * mas pega justamente o erro de digitar o nome errado.
 */

const DIR = join(process.cwd(), "supabase", "migrations");

const ARQUIVOS = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Remove comentários de linha para não caçar nomes de tabela dentro de prosa. */
function semComentarios(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/** Tabelas do schema `public` do sistema principal, criadas fora daqui. */
const EXTERNAS = new Set(["storage.buckets", "objects", "buckets"]);

describe("migrations: nomes de tabela existem", () => {
  it("encontrou os arquivos de migration", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(20);
  });

  it("nenhuma migration mexe numa tabela que ninguém criou", () => {
    const criadas = new Set<string>();
    const problemas: string[] = [];

    for (const arquivo of ARQUIVOS) {
      const sql = semComentarios(readFileSync(join(DIR, arquivo), "utf8")).toLowerCase();

      // A própria migration pode criar e alterar no mesmo arquivo, então
      // registra as criações antes de conferir as referências.
      for (const m of sql.matchAll(/create table(?:\s+if not exists)?\s+([a-z_][\w.]*)/g)) {
        criadas.add(m[1]);
      }

      const referencias = [
        ...sql.matchAll(/alter table(?:\s+if exists)?\s+([a-z_][\w.]*)/g),
        ...sql.matchAll(/create index(?:\s+if not exists)?\s+[\w.]+\s+on\s+([a-z_][\w.]*)/g),
        ...sql.matchAll(/comment on column\s+([a-z_]\w*)\./g),
      ];

      for (const ref of referencias) {
        const tabela = ref[1].replace(/^whatsapp\./, "");
        // SQL dinâmico (`format('alter table whatsapp.%I …', t)`, como no
        // 0024) não tem nome de tabela para conferir — o nome só existe em
        // tempo de execução. Fora do alcance de um leitor de strings.
        if (!tabela || tabela.includes("%")) continue;
        if (criadas.has(tabela) || EXTERNAS.has(tabela)) continue;
        problemas.push(`${arquivo} → "${tabela}"`);
      }
    }

    expect(
      problemas,
      `Tabela citada numa migration sem nunca ter sido criada (nome errado?):\n${problemas.join("\n")}\nTabelas conhecidas: ${[...criadas].sort().join(", ")}`,
    ).toEqual([]);
  });
});
