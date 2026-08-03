import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Espelha o alias "@/*" -> "./*" do tsconfig (raiz do projeto).
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Padrão Node (testes de lógica). Testes de componente pedem jsdom via
    // docblock `// @vitest-environment jsdom` no topo do arquivo.
    environment: "node",
    // Preenche o que falta no jsdom (matchMedia). Roda em todos os arquivos e
    // se protege sozinho no ambiente node — ver tests/setup.ts.
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
