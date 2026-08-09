import { describe, expect, it } from "vitest";
import { defaultsDoLink } from "./captacao-link";

/**
 * A ponta que recebe a captação vinda do WhatsApp. O app irmão não escreve mais
 * na tabela: manda o rascunho por query string e o cartão só nasce quando
 * alguém confirma o formulário completo daqui.
 */
describe("defaultsDoLink", () => {
  function params(qs: string) {
    return new URLSearchParams(qs);
  }

  it("sem o marcador, o link não é de nova captação", () => {
    expect(defaultsDoLink(params("endereco=Rua+X"))).toBeNull();
    expect(defaultsDoLink(params("nova=0&endereco=Rua+X"))).toBeNull();
  });

  it("lê os campos que o CRM manda", () => {
    expect(
      defaultsDoLink(
        params(
          "nova=1&endereco=Rua+Albert+Sabin%2C+10&quartos=5&banheiros=3" +
            "&tipo_portaria=casa&proprietario_nome=Fernanda+Lima&whatsapp=5511991234567&observacoes=teste",
        ),
      ),
    ).toEqual({
      endereco: "Rua Albert Sabin, 10",
      quartos: 5,
      banheiros: 3,
      tipo_portaria: "casa",
      proprietario_nome: "Fernanda Lima",
      whatsapp: "5511991234567",
      observacoes: "teste",
    });
  });

  it("campo ausente ou vazio não vira default (o formulário abre em branco)", () => {
    expect(defaultsDoLink(params("nova=1&endereco=Rua+X&tipo_portaria=&observacoes=+++"))).toEqual({
      endereco: "Rua X",
    });
  });

  /**
   * Número quebrado no link viraria NaN dentro do react-hook-form e o campo
   * renderiza vazio e "sujo" — pior que simplesmente não preencher.
   */
  it("número inválido é ignorado em vez de virar NaN", () => {
    expect(defaultsDoLink(params("nova=1&quartos=abc&banheiros=-1&vagas=999&suites=2"))).toEqual({
      suites: 2,
    });
  });

  it("ignora parâmetro que não é campo do formulário", () => {
    const defaults = defaultsDoLink(params("nova=1&endereco=Rua+X&decisao=aprovada&status=publicada"));
    expect(defaults).toEqual({ endereco: "Rua X" });
  });

  it("corta texto absurdamente longo", () => {
    const defaults = defaultsDoLink(params(`nova=1&observacoes=${"a".repeat(5000)}`));
    expect((defaults!.observacoes as string).length).toBe(2000);
  });
});
