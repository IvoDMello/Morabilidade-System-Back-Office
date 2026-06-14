import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Excluir imóvel"
      description="Esta ação não pode ser desfeita."
      onConfirm={onConfirm}
      {...props}
    />
  );
  return { onConfirm, onOpenChange };
}

describe("ConfirmDialog", () => {
  it("renderiza título e descrição quando aberto", () => {
    setup();
    expect(screen.getByText("Excluir imóvel")).toBeInTheDocument();
    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
  });

  it("não renderiza conteúdo quando fechado", () => {
    setup({ open: false });
    expect(screen.queryByText("Excluir imóvel")).not.toBeInTheDocument();
  });

  it("expõe o diálogo com papel acessível", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("usa o confirmLabel padrão 'Excluir'", () => {
    setup();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  it("aceita um confirmLabel customizado", () => {
    setup({ confirmLabel: "Remover" });
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();
  });

  it("chama onConfirm ao clicar no botão de confirmação", async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("fecha (onOpenChange false) ao clicar em Cancelar", async () => {
    const { onOpenChange } = setup();
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("desabilita os botões quando loading", () => {
    setup({ loading: true });
    expect(screen.getByRole("button", { name: "Excluir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });
});
