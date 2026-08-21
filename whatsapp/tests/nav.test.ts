import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  getMobileSectionInfo,
  getNavBadge,
  getParentRoute,
  type NavCounts,
} from "@/constants/nav";

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
    expect(NAV_ITEMS).toHaveLength(6);
  });

  it("Oportunidades vem depois das filas reativas e antes do cadastro", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs.indexOf("/oportunidades")).toBeGreaterThan(hrefs.indexOf("/pendencias"));
    expect(hrefs.indexOf("/oportunidades")).toBeLessThan(hrefs.indexOf("/contatos"));
  });

  it("todo item que não cabe na barra mobile tem rótulo curto", () => {
    // A barra inferior divide a largura igualmente entre os itens: com seis,
    // sobra pouco mais de 60px por coluna. "Pendências" (10) é o mais longo
    // que já cabe numa linha nesse espaço — daí o teto. "Oportunidades" só
    // entrou porque tem shortLabel; sem ele, quebraria em duas linhas e
    // desalinharia a fileira inteira.
    for (const item of NAV_ITEMS) {
      const rotulo = item.shortLabel ?? item.label;
      expect(rotulo.length, `rótulo mobile longo demais em ${item.href}`).toBeLessThanOrEqual(10);
    }
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
    // Oportunidades também não: sempre há algum match, então um selo ali
    // nunca zeraria — e selo que nunca zera deixa de ser lido.
    expect(getNavBadge(item("/oportunidades"), CONTAGENS)).toBeNull();
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

/**
 * A seta de voltar sobe um segmento da URL em vez de usar o histórico: quem
 * abre um link direto para a ficha de um contato tem que sair dela para
 * Contatos, não para fora do app.
 */
describe("Seta de voltar", () => {
  it("some nas telas de primeiro nível — a barra de navegação já é a saída", () => {
    for (const item of NAV_ITEMS) {
      expect(getParentRoute(item.href), `esperava null em ${item.href}`).toBeNull();
    }
  });

  it("não aparece no login, que não tem para onde voltar", () => {
    expect(getParentRoute("/login")).toBeNull();
  });

  it("da ficha do contato volta para Contatos, com o nome da seção", () => {
    expect(getParentRoute("/contatos/abc-123")).toEqual({
      href: "/contatos",
      label: "Contatos",
    });
  });

  it("do formulário de edição volta para a ficha, um degrau de cada vez", () => {
    expect(getParentRoute("/contatos/abc-123/editar")).toEqual({
      href: "/contatos/abc-123",
      label: null,
    });
  });

  it("de um cadastro novo volta para a lista", () => {
    expect(getParentRoute("/contatos/novo")?.href).toBe("/contatos");
  });

  it("ignora a barra final da URL", () => {
    expect(getParentRoute("/contatos/abc-123/")?.href).toBe("/contatos");
  });
});
