import { describe, expect, it } from "vitest";
import { STATUS_LABEL, STATUSES } from "@/types";
import { PILL_ORDER, STATUS_STYLE } from "./status-style";

describe("STATUS_STYLE", () => {
  it("todo status tem estilo, com o rótulo completo vindo de STATUS_LABEL", () => {
    for (const status of STATUSES) {
      const estilo = STATUS_STYLE[status];
      expect(estilo.label).toBe(STATUS_LABEL[status]);
      expect(estilo.short.length).toBeGreaterThan(0);
      for (const cor of [estilo.dot, estilo.bg, estilo.fg]) expect(cor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("as pills do mobile cobrem todos os status do quadro, sem repetir", () => {
    expect(new Set(PILL_ORDER).size).toBe(PILL_ORDER.length);
    expect([...PILL_ORDER, "publicada"].sort()).toEqual([...STATUSES].sort());
  });
});
