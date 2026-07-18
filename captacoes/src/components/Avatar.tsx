import { iniciaisNome, corAvatar } from "@/lib/opinioes";

/** Avatar de iniciais com cor estável por pessoa, usado no topo, opiniões etc. */
export function Avatar({ nome, size = 34 }: { nome: string; size?: number }) {
  const cor = corAvatar(nome);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ width: size, height: size, backgroundColor: cor.bg, color: cor.fg }}
      title={nome}
    >
      {iniciaisNome(nome)}
    </span>
  );
}
