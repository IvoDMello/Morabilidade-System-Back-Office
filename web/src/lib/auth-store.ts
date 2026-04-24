import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  nome_completo: string;
  email: string;
  perfil: "admin" | "administrativo";
  foto_url?: string;
  telefone?: string;
  ativo?: boolean;
}

interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  clearAuth: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
      logout: () => {
        set({ user: null });
        if (typeof window !== "undefined") {
          fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        }
      },
    }),
    { name: "morabilidade-user" }
  )
);
