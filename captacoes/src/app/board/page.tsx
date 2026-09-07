import { redirect } from "next/navigation";

/**
 * A v1 vivia em /board. A rota fica de pé só redirecionando: quem tem o PWA
 * instalado carrega o `start_url` antigo do manifest em cache, e há links e
 * favoritos espalhados. Sem isto, tudo isso cai num 404.
 *
 * Pode sair quando os PWAs instalados tiverem atualizado o manifest.
 */
export default function BoardLegado() {
  redirect("/decidir");
}
