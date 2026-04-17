import Link from "next/link";

export default function ImoveisPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Imóveis</h1>
          <p className="text-slate-500 text-sm">Gerencie o cadastro de imóveis</p>
        </div>
        <Link
          href="/imoveis/novo"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + Novo imóvel
        </Link>
      </div>

      {/* TODO: Filtros e tabela de imóveis */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Lista de imóveis será exibida aqui.
      </div>
    </div>
  );
}
