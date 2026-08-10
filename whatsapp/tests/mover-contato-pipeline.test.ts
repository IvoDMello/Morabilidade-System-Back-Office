import { describe, expect, it } from "vitest";
import { createContact, updateContact } from "@/services/contacts.service";
import { dataSource } from "@/services/data";

/**
 * Arrastar um cartão no Pipeline manda um patch com um campo só (`status`).
 * O patch chegava ao repositório com todas as outras chaves presentes e
 * `undefined` — e `{...atual, ...patch}` apaga o que vem indefinido. Resultado:
 * o contato perdia o telefone ao mudar de etapa e a tela quebrava no
 * `formatPhone` do cartão, já no re-render depois do arrasto.
 *
 * A regra que estes testes fixam: chave ausente ou `undefined` = "não mexe";
 * apagar de verdade é com `null`.
 */
describe("mover contato de etapa preserva o resto da ficha", () => {
  // Telefone é único no repositório, então cada caso cria o seu.
  let seq = 0;
  async function contatoDeTeste() {
    seq += 1;
    return createContact({
      name: "Carlos Eduardo Pinto",
      phone: `551195544${String(seq).padStart(4, "0")}`,
      email: "carlos@example.com",
      category: "proprietario",
      status: "novo",
      nextAction: "ligar",
    });
  }

  it("mudar só o status não apaga telefone, e-mail nem categoria", async () => {
    const criado = await contatoDeTeste();

    const movido = await updateContact(criado.id, { status: "aguardando_retorno" });

    expect(movido.status).toBe("aguardando_retorno");
    expect(movido.phone).toBe(criado.phone);
    expect(movido.email).toBe(criado.email);
    expect(movido.category).toBe(criado.category);
    expect(movido.name).toBe(criado.name);
  });

  it("o que foi gravado sobrevive à releitura (não só ao retorno da escrita)", async () => {
    const criado = await contatoDeTeste();
    await updateContact(criado.id, { status: "visita_marcada" });

    const relido = await dataSource.contacts.getById(criado.id);
    expect(relido?.phone).toBe(criado.phone);
    expect(relido?.status).toBe("visita_marcada");
  });

  it("null continua apagando — é assim que se limpa o motivo da perda", async () => {
    const criado = await contatoDeTeste();
    await updateContact(criado.id, {
      status: "perdido",
      lossReason: "sem_resposta",
      lossReasonNote: "não respondeu",
    });

    const voltou = await updateContact(criado.id, {
      status: "em_atendimento",
      lossReason: null,
      lossReasonNote: null,
    });

    expect(voltou.lossReason).toBeNull();
    expect(voltou.lossReasonNote).toBeNull();
    expect(voltou.phone).toBe(criado.phone);
  });
});
