export default function EditarImovelPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Editar imóvel</h1>
      <p className="text-slate-500 text-sm mb-6">ID: {params.id}</p>

      {/* TODO: Formulário de edição de imóvel */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        Formulário de edição de imóvel será implementado aqui.
      </div>
    </div>
  );
}
