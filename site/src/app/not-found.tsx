import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-neutral-600 max-w-md">
        O endereço que você acessou não existe ou foi removido.
      </p>
      <Link
        href="/"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Voltar para a home
      </Link>
    </main>
  );
}
