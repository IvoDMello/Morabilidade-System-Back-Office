import type { ID } from "./common";

/** Corretor/atendente da operação — responsável por contatos e visitas. */
export interface Corretor {
  id: ID;
  nome: string;
  /** Vínculo com o login (auth.users); null se o corretor não usa o app. */
  authUserId: string | null;
  cor: string;
  ativo: boolean;
  createdAt: string;
}
