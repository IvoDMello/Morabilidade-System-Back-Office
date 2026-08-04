import { AssistantConsole } from "@/features/assistant/components/assistant-console";

export const metadata = { title: "Assistente" };

export default function AssistentePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Assistente</h1>
        <p className="text-sm text-muted-foreground">
          Descreva o que precisa e confirme as ações. O assistente propõe — nada é feito sem a sua confirmação.
        </p>
      </div>

      <AssistantConsole captacoesUrl={process.env.CAPTACOES_BOARD_URL ?? null} />
    </div>
  );
}
