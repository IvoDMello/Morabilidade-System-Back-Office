import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase no navegador, usado APENAS no fluxo de redefinição de senha.
 *
 * O resto do painel autentica via nosso backend (FastAPI) e mantém o JWT em
 * cookie httpOnly. Este client existe porque o link enviado pelo Supabase Auth
 * em e-mails de recovery vem com tokens no fragment da URL (#access_token=...),
 * e o supabase-js processa isso automaticamente — reimplementar essa lógica
 * no nosso backend daria mais código e mais surface de bug.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidas no .env.local."
    );
  }
  _client = createClient(url, anonKey, {
    auth: {
      // Não persistimos sessão — o painel usa nosso próprio cookie. A sessão criada
      // aqui é efêmera e exclusiva da troca de senha.
      persistSession: false,
      autoRefreshToken: false,
      // Lê automaticamente o token do fragment "#access_token=...&type=recovery"
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
  return _client;
}
