import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { SearchTracker } from "@/components/analytics/SearchTracker";

describe("SearchTracker", () => {
  const sendBeacon = vi.fn(() => true);

  beforeEach(() => {
    sendBeacon.mockClear();
    vi.stubGlobal("navigator", { sendBeacon });
    window.sessionStorage.clear();
  });

  it("não dispara nada quando não há filtros nem termo", () => {
    render(<SearchTracker params={{}} total={42} />);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("não dispara para params irrelevantes (page=)", () => {
    render(<SearchTracker params={{ page: "2" }} total={42} />);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("dispara quando um filtro estruturado está presente", async () => {
    render(<SearchTracker params={{ tipo_negocio: "venda" }} total={10} />);
    expect(sendBeacon).toHaveBeenCalledOnce();
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.filtros).toEqual({ tipo_negocio: "venda" });
    expect(payload.resultados_count).toBe(10);
    expect(payload.termo).toBeNull();
  });

  it("dispara quando q= está presente (termo livre)", async () => {
    render(<SearchTracker params={{ q: "ipanema" }} total={3} />);
    expect(sendBeacon).toHaveBeenCalledOnce();
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.termo).toBe("ipanema");
  });

  it("normaliza bairro=string em array", async () => {
    render(<SearchTracker params={{ bairro: "Leblon" }} total={5} />);
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.filtros.bairro).toEqual(["Leblon"]);
  });

  it("preserva bairro multi-valor", async () => {
    render(<SearchTracker params={{ bairro: ["Ipanema", "Leblon"] }} total={8} />);
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.filtros.bairro).toEqual(["Ipanema", "Leblon"]);
  });

  it("re-render com mesma busca não duplica o evento (dedupe)", () => {
    const { rerender } = render(<SearchTracker params={{ tipo_negocio: "venda" }} total={10} />);
    rerender(<SearchTracker params={{ tipo_negocio: "venda" }} total={10} />);
    expect(sendBeacon).toHaveBeenCalledOnce();
  });

  it("re-render com filtro diferente dispara novo evento", () => {
    const { rerender } = render(<SearchTracker params={{ tipo_negocio: "venda" }} total={10} />);
    rerender(<SearchTracker params={{ tipo_negocio: "locacao" }} total={4} />);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});
