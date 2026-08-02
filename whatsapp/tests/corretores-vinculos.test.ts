import { describe, it, expect } from "vitest";
import { dataSource } from "@/services/data";

/**
 * Bloco Fundação: corretores (entidade + seed), atribuição de responsável ao
 * contato/visita e papel do contato no imóvel (relacao). Exercita o contrato
 * DataSource na fonte mock (a mesma interface da fonte Supabase).
 */

describe("corretores", () => {
  it("lista os corretores seed ativos", async () => {
    const nomes = (await dataSource.corretores.list()).map((c) => c.nome);
    expect(nomes).toEqual(expect.arrayContaining(["Rodrigo", "Leandro", "Ivo"]));
  });
});

describe("atribuição de responsável", () => {
  it("contato nasce sem responsável e aceita atribuição", async () => {
    const [corretor] = await dataSource.corretores.list();
    const contact = await dataSource.contacts.create({
      name: "Teste Atribuição",
      phone: "5511977770001",
      category: "lead",
      status: "novo",
      nextAction: "ligar",
    });
    expect(contact.corretorId).toBeNull();

    const updated = await dataSource.contacts.update(contact.id, { corretorId: corretor.id });
    expect(updated.corretorId).toBe(corretor.id);
  });

  it("visita (lembrete) grava o corretor responsável", async () => {
    const [corretor] = await dataSource.corretores.list();
    const contact = await dataSource.contacts.create({
      name: "Teste Visita",
      phone: "5511977770003",
      category: "lead",
      status: "novo",
      nextAction: "ligar",
    });
    const reminder = await dataSource.reminders.create({
      contactId: contact.id,
      title: "Visita — MB-00099",
      reminderAt: new Date().toISOString(),
      createdBy: "Teste",
      corretorId: corretor.id,
    });
    expect(reminder.corretorId).toBe(corretor.id);
  });
});

describe("papel do contato no imóvel (relacao)", () => {
  it("vincula com papel e depois troca o papel", async () => {
    const contact = await dataSource.contacts.create({
      name: "Teste Papel",
      phone: "5511977770002",
      category: "proprietario",
      status: "novo",
      nextAction: "ligar",
    });
    const property = await dataSource.properties.create({ code: "MB-TEST-01", title: null });

    await dataSource.properties.addToContact(contact.id, property.id, "proprietario", "interesse");
    let links = await dataSource.properties.listByContact(contact.id);
    expect(links[0].relacao).toBe("proprietario");

    await dataSource.properties.updateRelacao(contact.id, property.id, "visitado");
    links = await dataSource.properties.listByContact(contact.id);
    expect(links[0].relacao).toBe("visitado");
  });
});
