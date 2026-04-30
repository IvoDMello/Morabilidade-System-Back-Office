import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  nome_completo: string;
  email: string;
  perfil: "admin" | "corretor";
  foto_url?: string;
  telefone?: string;
  ativo?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      clearAuth: () => set({ user: null, token: null }),
      logout: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        }
      },
    }),
    { name: "morabilidade-user" }
  )
);
