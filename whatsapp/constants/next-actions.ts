import type { LucideIcon } from "lucide-react";
import { Phone, CalendarClock, FileText, Handshake, Clock, MoreHorizontal } from "lucide-react";
import { SEMANTIC_TONES } from "./semantic-colors";

export const NEXT_ACTIONS = [
  { value: "ligar", label: "Ligar" },
  { value: "agendar_visita", label: "Agendar visita" },
  { value: "enviar_documentacao", label: "Enviar documentação" },
  { value: "negociar_proposta", label: "Negociar proposta" },
  { value: "aguardar_retorno", label: "Aguardar retorno" },
  { value: "outro", label: "Outro" },
] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number]["value"];

export const NEXT_ACTION_LABELS: Record<NextAction, string> = Object.fromEntries(
  NEXT_ACTIONS.map((a) => [a.value, a.label]),
) as Record<NextAction, string>;

// Cores da próxima ação — paleta semântica única. "Aguardar retorno" deixou de
// ser cinza e agora usa o mesmo tom de "aguardando" do status homônimo (fim da
// contradição em que a mesma palavra tinha duas cores).
export const NEXT_ACTION_COLORS: Record<NextAction, string> = {
  ligar: SEMANTIC_TONES.success,
  agendar_visita: SEMANTIC_TONES.info,
  enviar_documentacao: SEMANTIC_TONES.progress,
  negociar_proposta: SEMANTIC_TONES.attention,
  aguardar_retorno: SEMANTIC_TONES.waiting,
  outro: SEMANTIC_TONES.neutral,
};

// Ícones para o tratamento "texto simples + ícone" da próxima ação em listas
// (LT-1) — sem pastel, para não competir com os badges de categoria/status.
export const NEXT_ACTION_ICONS: Record<NextAction, LucideIcon> = {
  ligar: Phone,
  agendar_visita: CalendarClock,
  enviar_documentacao: FileText,
  negociar_proposta: Handshake,
  aguardar_retorno: Clock,
  outro: MoreHorizontal,
};
