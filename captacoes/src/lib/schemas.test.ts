import { describe, it, expect } from "vitest";
import { captacaoSchema, moverSchema, videoSchema, signUploadSchema } from "./schemas";

describe("captacaoSchema", () => {
  it("exige endereço", () => {
    const r = captacaoSchema.safeParse({ endereco: "" });
    expect(r.success).toBe(false);
  });

  it("aceita só o endereço (demais campos em branco)", () => {
    const r = captacaoSchema.safeParse({ endereco: "Rua A, 100" });
    expect(r.success).toBe(true);
  });

  it("converte numéricos vazios para null", () => {
    const r = captacaoSchema.parse({ endereco: "X", quartos: "", suites: "" });
    expect(r.quartos).toBeNull();
    expect(r.suites).toBeNull();
  });

  it("converte string numérica para number", () => {
    const r = captacaoSchema.parse({ endereco: "X", quartos: "3" });
    expect(r.quartos).toBe(3);
  });

  it("rejeita quartos fora do intervalo", () => {
    expect(captacaoSchema.safeParse({ endereco: "X", quartos: "100" }).success).toBe(false);
  });

  it("metragem aceita decimal com vírgula", () => {
    const r = captacaoSchema.parse({ endereco: "X", metragem: "72,5" });
    expect(r.metragem).toBe(72.5);
  });

  it("valores monetários em formato BR", () => {
    const r = captacaoSchema.parse({ endereco: "X", valor_venda: "1.250.000,00" });
    expect(r.valor_venda).toBe(1250000);
  });

  it("anuncio_url vazio vira null", () => {
    const r = captacaoSchema.parse({ endereco: "X", anuncio_url: "" });
    expect(r.anuncio_url).toBeNull();
  });

  it("anuncio_url inválido falha", () => {
    expect(captacaoSchema.safeParse({ endereco: "X", anuncio_url: "nao-e-url" }).success).toBe(false);
  });

  it("anuncio_url válido passa", () => {
    const r = captacaoSchema.safeParse({ endereco: "X", anuncio_url: "https://olx.com/x" });
    expect(r.success).toBe(true);
  });

  it("whatsapp com menos de 10 dígitos falha", () => {
    expect(captacaoSchema.safeParse({ endereco: "X", whatsapp: "(11) 9999" }).success).toBe(false);
  });

  it("whatsapp com DDD válido passa", () => {
    expect(captacaoSchema.safeParse({ endereco: "X", whatsapp: "(11) 98888-7777" }).success).toBe(true);
  });
});

describe("moverSchema", () => {
  it("aceita status válido + ordem", () => {
    const r = moverSchema.safeParse({ para_status: "aguardando_informacoes", ordem: 10 });
    expect(r.success).toBe(true);
  });
  it("rejeita status inválido", () => {
    expect(moverSchema.safeParse({ para_status: "inexistente", ordem: 1 }).success).toBe(false);
  });
  it("aceita decisão opcional", () => {
    expect(
      moverSchema.safeParse({ para_status: "em_decisao", ordem: 1, decisao: "aprovada" }).success
    ).toBe(true);
  });
});

describe("videoSchema", () => {
  it("exige URL válida", () => {
    expect(videoSchema.safeParse({ url_externa: "https://youtu.be/x" }).success).toBe(true);
    expect(videoSchema.safeParse({ url_externa: "abc" }).success).toBe(false);
  });
});

describe("signUploadSchema", () => {
  it("valida uuid + tipo + extensão", () => {
    const r = signUploadSchema.safeParse({
      captacao_id: "11111111-1111-1111-1111-111111111111",
      tipo: "foto",
      ext: "webp",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita uuid inválido", () => {
    expect(signUploadSchema.safeParse({ captacao_id: "x", tipo: "foto", ext: "webp" }).success).toBe(false);
  });
  it("rejeita extensão com caractere inválido", () => {
    expect(
      signUploadSchema.safeParse({
        captacao_id: "11111111-1111-1111-1111-111111111111",
        tipo: "documento",
        ext: "pd f",
      }).success
    ).toBe(false);
  });
});
