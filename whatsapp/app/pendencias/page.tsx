import { PendenciasTabs } from "@/features/pendencias/components/pendencias-tabs";
import { AiPendencias } from "@/features/pendencias/components/ai-pendencias";
import { PlacarAgente } from "@/features/pendencias/components/placar-agente";
import { getPendingQueue } from "@/services/whatsapp.service";
import { getPlacar } from "@/services/agent-proposals.service";

export default async function PendenciasPage() {
  // Placar é best-effort: sem a migration 0020 aplicada, a página segue inteira.
  const [queue, placar] = await Promise.all([
    getPendingQueue(),
    getPlacar().catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden items-center gap-3.5 md:flex">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Pendências</h1>
        {queue.aguardandoResposta.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,122,122,0.28)] bg-[rgba(239,122,122,0.12)] px-2.5 py-1 text-[12.5px] font-semibold text-ember">
            {queue.aguardandoResposta.length} aguardando resposta
          </span>
        )}
      </div>

      <AiPendencias />

      {placar && <PlacarAgente placar={placar} />}

      <PendenciasTabs queue={queue} />
    </div>
  );
}
