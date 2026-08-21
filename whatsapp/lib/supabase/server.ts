import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Credenciais do servidor, com erro que diz o que fazer.
 *
 * Sem isto, faltar a chave devolvia "supabaseKey is required" — mensagem do
 * driver, que não conta qual variável falta nem em qual arquivo. Custou uma
 * sessão de debug para descobrir que era `SUPABASE_SERVICE_ROLE_KEY` vazia no
 * `.env.local`.
 */
function credenciaisDoServidor(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const faltando = [
    url ? null : "NEXT_PUBLIC_SUPABASE_URL",
    serviceRoleKey ? null : "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (faltando.length > 0) {
    throw new Error(
      `Supabase não configurado: falta ${faltando.join(" e ")} no .env.local. ` +
        "A chave service_role está no painel do Supabase em Settings → API. " +
        'Para rodar sem banco nenhum, use NEXT_PUBLIC_DATA_SOURCE="mock".',
    );
  }
  return { url: url!, serviceRoleKey: serviceRoleKey! };
}

// O 3º parâmetro genérico fixa o schema `whatsapp` (sem ele o tipo default é
// "public" e o singleton não compila).
type WhatsappClient = SupabaseClient<any, any, "whatsapp">;

let serverClient: WhatsappClient | null = null;

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor (Server Components, Server
 * Actions, route handlers, crons e webhook).
 *
 * Integração ao monorepo (2026-07-25): usa a service_role key (ignora RLS) e o
 * schema `whatsapp` do Supabase PRINCIPAL do sistema — ver
 * supabase/migrations/0000_schema.sql. A proteção de acesso vem de cima:
 * middleware.ts exige login nas páginas, o webhook valida assinatura da Meta e
 * os crons validam CRON_SECRET. Nunca importar este módulo em Client Component.
 */
export function getSupabaseServerClient(): WhatsappClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseServerClient() não pode ser usado no navegador.");
  }
  if (!serverClient) {
    const { url, serviceRoleKey } = credenciaisDoServidor();
    serverClient = createClient(url, serviceRoleKey, {
      db: { schema: "whatsapp" },
      auth: { persistSession: false },
    });
  }
  return serverClient;
}

// O assistente (fase 2) pode criar captações — que vivem no schema `captacoes`
// do MESMO Supabase (app irmão do monorepo). Cliente separado só para esse
// cruzamento de fronteira, também com service_role.
type CaptacoesClient = SupabaseClient<any, any, "captacoes">;

let captacoesClient: CaptacoesClient | null = null;

/**
 * Cliente Supabase no schema `captacoes` (server-only). Usado apenas pelo
 * assistente para inserir uma captação a partir de uma ação confirmada.
 */
export function getSupabaseCaptacoesClient(): CaptacoesClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseCaptacoesClient() não pode ser usado no navegador.");
  }
  if (!captacoesClient) {
    const { url, serviceRoleKey } = credenciaisDoServidor();
    captacoesClient = createClient(url, serviceRoleKey, {
      db: { schema: "captacoes" },
      auth: { persistSession: false },
    });
  }
  return captacoesClient;
}

// A aba de Oportunidades cruza contato × catálogo, e o catálogo (`imoveis`,
// `cliente_preferencias`) mora no schema `public` do MESMO Supabase — é o
// banco da API principal. Terceiro cliente pelo mesmo motivo do de captações:
// o schema é fixado na criação do client. Aqui, diferente dos dois de cima,
// não precisa do genérico explícito — `public` já é o schema padrão do tipo.
type SistemaClient = SupabaseClient;

let sistemaClient: SistemaClient | null = null;

/**
 * Cliente Supabase no schema `public` — o banco do sistema principal
 * (server-only). Leitura do catálogo de imóveis e leitura/escrita das
 * preferências de busca do cliente.
 *
 * Por que direto no banco e não pela API: os endpoints de oportunidade
 * (`/clientes/{id}/matches`, `/clientes/{id}/preferencia`) exigem JWT de
 * usuário, e o CRM fala com a API por token de serviço. Não havendo endpoint
 * interno equivalente, o caminho é o mesmo que o CRM já usa para o schema
 * `captacoes`: service_role no Supabase compartilhado.
 *
 * Escrever em tabela de outro app pede disciplina — por isso a escrita fica
 * restrita a `cliente_preferencias` (ver services/oportunidades.service.ts),
 * que é exatamente a tabela que o back-office também trata como editável.
 */
export function getSupabaseSistemaClient(): SistemaClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseSistemaClient() não pode ser usado no navegador.");
  }
  if (!sistemaClient) {
    const { url, serviceRoleKey } = credenciaisDoServidor();
    sistemaClient = createClient(url, serviceRoleKey, {
      db: { schema: "public" },
      auth: { persistSession: false },
    });
  }
  return sistemaClient;
}
