import type { DataSource } from "../types";
import { mockStore } from "./store";

export const mockCorretores: DataSource["corretores"] = {
  async list() {
    return mockStore.corretores
      .filter((c) => c.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },

  async getByAuthUserId(authUserId: string) {
    return mockStore.corretores.find((c) => c.authUserId === authUserId) ?? null;
  },
};
