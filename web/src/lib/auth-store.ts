import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  nome_completo: string;
  email: string;
  perfil: "admin" | "administrativo";
  foto_url?: string;
  telefone?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => {
        set({ token });
        document.cookie = `morabilidade-auth=${token}; path=/; max-age=${60 * 60 * 8}`;
      },
      setUser: (user) => set({ user }),
      logout: () => {
        set({ token: null, user: null });
        document.cookie = "morabilidade-auth=; path=/; max-age=0";
      },
    }),
    { name: "morabilidade-auth" }
  )
);
