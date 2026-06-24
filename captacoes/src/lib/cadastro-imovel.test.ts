import { describe, it, expect } from "vitest";
import {
  camposFaltando,
  formInicial,
  montarRequest,
  numToStr,
  strToNum,
  type CadastroForm,
} from "./cadastro-imovel";
import type { Captacao } from "@/types";

function captacao(p: Partial<Captacao>): Captacao {
  return {
    id: "cap-1",
    status: "pendente_agendar_visita",
    ordem: 0,
    endereco: "",
    ...p,
  } as Captacao;
}

describe("numToStr / strToNum", () => {
  it("numToStr converte número e trata null/undefined", () => {
    expect(numToStr(3)).toBe("3");
    expect(numToStr(0)).toBe("0");
    expect(numToStr(null)).toBe("");
    expect(numToStr(undefined)).toBe("");
  });

  it("strToNum aceita inteiros, espaços e rejeita lixo", () => {
    expect(strToNum("172")).toBe(172);
    expect(strToNum(" 10 ")).toBe(10);
    expect(strToNum("")).toBeNull();
    expect(strToNum("   ")).toBeNull();
    expect(strToNum("abc")).toBeNull();
    // separador de milhar com ponto não é suportado (vira NaN → null)
    expect(strToNum("1.250,5")).toBeNull();
  });

  it("strToNum interpreta vírgula como separador decimal", () => {
    expect(strToNum("3,5")).toBe(3.5);
  });
});

describe("formInicial", () => {
  it("pré-preenche da captação com defaults seguros", () => {
    const f = formInicial(
      captacao({
        endereco: "Rua Itaipava 71",
        quartos: 3,
        suites: 2,
        banheiros: null,
        vagas: 3,
        metragem: 172,
        valor_venda: 1500000,
        valor_condominio: 1200,
        valor_iptu: 300,
        proprietario_nome: "Carla",
        whatsapp: "21988886666",
      }),
    );
    expect(f.tipo_negocio).toBe("venda");
    expect(f.condicao).toBe("usado");
    expect(f.cidade).toBe("Rio de Janeiro");
    expect(f.tipo_imovel).toBe(""); // sempre exige escolha
    expect(f.logradouro).toBe("Rua Itaipava 71");
    expect(f.dormitorios).toBe("3");
    expect(f.banheiros).toBe(""); // null vira vazio
    expect(f.area_util).toBe("172");
    expect(f.prop_nome).toBe("Carla");
    expect(f.prop_whatsapp).toBe("21988886666");
  });

  it("lida com captação sem dados (campos nulos)", () => {
    const f = formInicial(captacao({ endereco: "" }));
    expect(f.logradouro).toBe("");
    expect(f.dormitorios).toBe("");
    expect(f.prop_nome).toBe("");
  });
});

describe("camposFaltando", () => {
  const base = (): CadastroForm =>
    formInicial(
      captacao({ endereco: "Rua X", proprietario_nome: "Ana" }),
    );

  it("aponta tipo_imovel e bairro vazios por padrão", () => {
    expect(camposFaltando(base())).toEqual(["Tipo de imóvel", "Bairro"]);
  });

  it("fica vazio quando tudo obrigatório está preenchido", () => {
    const f = { ...base(), tipo_imovel: "apartamento", bairro: "Jardim Botânico" };
    expect(camposFaltando(f)).toEqual([]);
  });

  it("considera só-espaços como vazio", () => {
    const f = { ...base(), tipo_imovel: "apartamento", bairro: "   " };
    expect(camposFaltando(f)).toEqual(["Bairro"]);
  });

  it("aceita bairro com acento e maiúsculas", () => {
    const f = { ...base(), tipo_imovel: "apartamento", bairro: "Lagoa Rodrigo de Freitas" };
    expect(camposFaltando(f)).toEqual([]);
  });
});

describe("montarRequest", () => {
  const completo = (): CadastroForm => ({
    ...formInicial(
      captacao({
        endereco: "Rua Itaipava 71",
        quartos: 3,
        suites: 2,
        vagas: 3,
        metragem: 172,
        valor_venda: 1500000,
        proprietario_nome: "Carla",
        whatsapp: "21988886666",
        anuncio_url: "https://zap.com/anuncio-de-outra-imobiliaria",
      }),
    ),
    tipo_imovel: "apartamento",
    bairro: "Jardim Botânico",
    numero: "71",
  });

  it("monta proprietário e imóvel com tipos numéricos corretos", () => {
    const { proprietario, imovel } = montarRequest(completo());
    expect(proprietario).toEqual({ nome_completo: "Carla", telefone: "21988886666" });
    expect(imovel.tipo_imovel).toBe("apartamento");
    expect(imovel.bairro).toBe("Jardim Botânico");
    expect(imovel.numero).toBe("71");
    expect(imovel.dormitorios).toBe(3);
    expect(imovel.area_util).toBe(172);
    expect(imovel.valor_venda).toBe(1500000);
  });

  it("cadastra o imóvel como reservado", () => {
    const { imovel } = montarRequest(completo());
    expect(imovel.disponibilidade).toBe("reservado");
  });

  it("NÃO envia o link do anúncio nem fotos para o imóvel", () => {
    const { imovel } = montarRequest(completo());
    // anúncio é referência interna (outras imobiliárias) — não vai pro imóvel
    expect(imovel).not.toHaveProperty("instagram_url");
    expect(imovel).not.toHaveProperty("anuncio_url");
    // fotos/mídia nunca fazem parte do payload do cadastro
    expect(imovel).not.toHaveProperty("fotos");
    expect(JSON.stringify(imovel)).not.toContain("anuncio");
  });

  it("manda null para campos vazios opcionais", () => {
    const f = { ...completo(), numero: "", complemento: "", iptu_mensal: "" };
    const { imovel } = montarRequest(f);
    expect(imovel.numero).toBeNull();
    expect(imovel.complemento).toBeNull();
    expect(imovel.iptu_mensal).toBeNull();
  });

  it("faz trim de texto antes de enviar", () => {
    const f = { ...completo(), bairro: "  Leblon  ", prop_nome: "  Carla  " };
    const { proprietario, imovel } = montarRequest(f);
    expect(imovel.bairro).toBe("Leblon");
    expect(proprietario.nome_completo).toBe("Carla");
  });
});
