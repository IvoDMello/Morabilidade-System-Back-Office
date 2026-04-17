import Link from "next/link";

export default function ClientesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm">Gerencie clientes e leads</p>
        </div>
        <Link
          href="/clientes/novo"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + Novo cliente
        </Link>
      </div>

      {/* TODO: Filtros e tabela de clientes */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Lista de clientes será exibida aqui.
      </div>
    </div>
  );
}
