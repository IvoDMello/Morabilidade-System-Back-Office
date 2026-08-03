import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getMobileSectionInfo, getNavBadge, type NavCounts } from "@/constants/nav";

const CONTAGENS: NavCounts = {
  reminderCounts: { pending: 12, overdue: 3 },
  unreadConversations: 4,
  pendingConversations: 5,
};

function item(href: string) {
  const encontrado = NAV_ITEMS.find((i) => i.href === href);
  if (!encontrado) throw new Error(`Item de nav ausente: ${href}`);
  return encontrado;
}

/**
 * A navegação é o mapa do app: a ordem diz o que importa e o selo diz onde
 * há trabalho parado. Pendências e Lembretes eram dois destinos para a mesma
 * pergunta — estes testes travam a unificação e a nova ordem.
 */
describe("Navegação principal", () => {
  it("abre em Conversas — é a tela de trabalho", () => {
    expect(NAV_ITEMS[0].href).toBe("/");
    expect(NAV_ITEMS[0].label).toBe("Conversas");
  });

  it("não tem mais um destino separado para lembretes", () => {
    expect(NAV_ITEMS.map((i) => i.href)).not.toContain("/lembretes");
    expect(NAV_ITEMS).toHaveLength(5);
  });

  it("o selo de Pendências soma as duas filas que o item agora representa", () => {
    const badge = getNavBadge(item("/pendencias"), CONTAGENS);
    // 5 conversas aguardando + 3 lembretes vencidos. Lembretes futuros ficam
    // de fora de propósito: um selo que conta o que vence semana que vem nunca
    // zera, e um selo que nunca zera deixa de ser lido.
    expect(badge).toEqual({ count: 8, tone: "action", noun: "pendências" });
  });

  it("o selo de Conversas conta só as não lidas, em tom próprio", () => {
    expect(getNavBadge(item("/"), CONTAGENS)).toEqual({
      count: 4,
      tone: "unread",
      noun: "não lidas",
    });
  });

  it("itens sem fila não ganham selo", () => {
    expect(getNavBadge(item("/contatos"), CONTAGENS)).toBeNull();
    expect(getNavBadge(item("/dashboard"), CONTAGENS)).toBeNull();
  });

  it("o header mobile descreve Pendências como as duas coisas que ela reúne", () => {
    const info = getMobileSectionInfo("/pendencias");
    expect(info.title).toBe("Pendências");
    expect(info.subtitle).toMatch(/lembretes/i);
  });

  it("rotas filhas herdam o título da seção", () => {
    expect(getMobileSectionInfo("/contatos/abc-123").title).toBe("Contatos");
  });
});
