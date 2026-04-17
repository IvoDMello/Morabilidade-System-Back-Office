export default function TagsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
          <p className="text-slate-500 text-sm">Etiquetas configuráveis para os imóveis</p>
        </div>
      </div>

      {/* TODO: Lista de tags com criação/edição inline */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Gerenciamento de tags será implementado aqui.
      </div>
    </div>
  );
}
