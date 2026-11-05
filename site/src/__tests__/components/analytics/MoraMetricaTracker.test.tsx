import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { MoraMetricaTracker } from "@/components/analytics/MoraMetricaTracker";

describe("MoraMetricaTracker", () => {
  const sendBeacon = vi.fn((_url: string, _data?: BodyInit) => true);

  beforeEach(() => {
    sendBeacon.mockClear();
    vi.stubGlobal("navigator", { sendBeacon });
    window.sessionStorage.clear();
  });

  it("registra a busca com o tipo de resultado", async () => {
    render(<MoraMetricaTracker busca="/morametrica?q=Rua+Bom+Pastor%2C+521" tipo="predio" />);
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(sendBeacon.mock.calls[0][0]).toMatch(/\/publico\/morametrica$/);
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.tipo).toBe("predio");
    expect(payload.session_id).toBeTruthy();
  });

  it("não manda o texto digitado", async () => {
    render(<MoraMetricaTracker busca="/morametrica?q=Rua+Bom+Pastor%2C+521" tipo="predio" />);
    const corpo = await (sendBeacon.mock.calls[0][1] as Blob).text();
    expect(corpo).not.toMatch(/Bom Pastor|Bom\+Pastor/);
    expect(Object.keys(JSON.parse(corpo)).sort()).toEqual(["session_id", "tipo"]);
  });

  it("manda a rua e o bairro, nunca o número nem a unidade", async () => {
    render(
      <MoraMetricaTracker
        busca="/morametrica?cl=12345&numero=521&unidade=Apto+0801"
        tipo="unidade"
        local={{ cl: 12345, bairro: "Tijuca" }}
      />,
    );
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(Object.keys(payload).sort()).toEqual(["bairro", "cl", "session_id", "tipo"]);
    expect(payload).toMatchObject({ cl: 12345, bairro: "Tijuca" });
  });

  it("busca de bairro manda só o bairro", async () => {
    render(<MoraMetricaTracker busca="/morametrica?bairro=ipanema" tipo="bairro" local={{ bairro: "Ipanema" }} />);
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.bairro).toBe("Ipanema");
    expect(payload).not.toHaveProperty("cl");
  });

  it("re-render da mesma busca (filtro, ordem, página) não conta de novo", () => {
    const { rerender } = render(<MoraMetricaTracker busca="/morametrica?bairro=ipanema" tipo="bairro" />);
    rerender(<MoraMetricaTracker busca="/morametrica?bairro=ipanema" tipo="bairro" />);
    expect(sendBeacon).toHaveBeenCalledOnce();
  });

  it("outra busca conta como nova", async () => {
    const { rerender } = render(<MoraMetricaTracker busca="/morametrica?q=bom+pastor" tipo="ambiguo" />);
    rerender(<MoraMetricaTracker busca="/morametrica?cl=12345&q=bom+pastor" tipo="rua" />);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    const segunda = JSON.parse(await (sendBeacon.mock.calls[1][1] as Blob).text());
    expect(segunda.tipo).toBe("rua");
  });
});
