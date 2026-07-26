import { describe, expect, it } from "vitest";
import { AcaoInvalidaError, parseSaoPauloLocal, validarHorarioVisita } from "./visita-range";

// "Agora" fixo para os testes: sexta-feira, 24/07/2026 12:00 São Paulo (15:00 UTC).
const AGORA = new Date("2026-07-24T15:00:00Z");

describe("parseSaoPauloLocal", () => {
  it("converte horário local SP para o instante UTC correto (UTC-3)", () => {
    const { utc, hora } = parseSaoPauloLocal("2026-07-28T15:00");
    expect(utc.toISOString()).toBe("2026-07-28T18:00:00.000Z");
    expect(hora).toBe(15);
  });

  it("identifica domingo pelo dia local", () => {
    // 2026-07-26 é um domingo.
    expect(parseSaoPauloLocal("2026-07-26T10:00").diaSemana).toBe(0);
  });

  it("rejeita formato inválido", () => {
    expect(() => parseSaoPauloLocal("28/07/2026 15h")).toThrow(AcaoInvalidaError);
  });
});

describe("validarHorarioVisita", () => {
  it("aceita um horário comercial futuro em dia útil", () => {
    const utc = validarHorarioVisita("2026-07-28T15:00", AGORA); // terça 15h
    expect(utc.toISOString()).toBe("2026-07-28T18:00:00.000Z");
  });

  it("rejeita horário no passado", () => {
    expect(() => validarHorarioVisita("2026-07-20T10:00", AGORA)).toThrow(/futura/);
  });

  it("rejeita antes das 8h e a partir das 19h", () => {
    expect(() => validarHorarioVisita("2026-07-28T07:00", AGORA)).toThrow(/horário de visitas/);
    expect(() => validarHorarioVisita("2026-07-28T19:00", AGORA)).toThrow(/horário de visitas/);
  });

  it("rejeita domingo", () => {
    // 2026-07-26 (domingo) às 10h.
    expect(() => validarHorarioVisita("2026-07-26T10:00", AGORA)).toThrow(/domingo/);
  });

  it("rejeita além de 60 dias à frente", () => {
    expect(() => validarHorarioVisita("2026-10-30T10:00", AGORA)).toThrow(/60 dias/);
  });

  it("aceita o limite inferior 8h e rejeita o superior 19h (borda)", () => {
    expect(validarHorarioVisita("2026-07-28T08:00", AGORA)).toBeInstanceOf(Date);
    expect(() => validarHorarioVisita("2026-07-28T18:59", AGORA)).not.toThrow();
  });
});
