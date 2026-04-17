export default function DashboardHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Painel</h1>
      <p className="text-slate-500 text-sm mb-6">Bem-vindo ao sistema de gestão Morabilidade.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Imóveis cadastrados" value="—" />
        <StatCard label="Imóveis disponíveis" value="—" />
        <StatCard label="Clientes cadastrados" value="—" />
        <StatCard label="Em negociação" value="—" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  );
}
