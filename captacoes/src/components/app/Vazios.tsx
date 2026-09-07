"use client";

import { CalendarDays, CheckCircle2, MessageSquareHeart, SearchX, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Anatomia comum dos estados vazios: ícone em disco suave, título serifado, uma linha de texto. */
function Vazio({
  Icone,
  tom,
  titulo,
  texto,
  acao,
}: {
  Icone: typeof CheckCircle2;
  tom: { bg: string; fg: string };
  titulo: string;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <span
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px]"
        style={{ background: tom.bg }}
      >
        <Icone className="h-7 w-7" style={{ color: tom.fg }} strokeWidth={1.7} />
      </span>
      <h2 className="font-serif text-xl font-semibold text-foreground">{titulo}</h2>
      <p className="mt-2 max-w-[250px] text-[13px] leading-relaxed text-muted-foreground [text-wrap:pretty]">
        {texto}
      </p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function VazioDecidir() {
  return (
    <Vazio
      Icone={CheckCircle2}
      tom={{ bg: "#e5efe8", fg: "#2f6b46" }}
      titulo="Fila zerada"
      texto="Nenhuma captação esperando decisão. As novas aparecem aqui assim que a equipe cadastrar."
    />
  );
}

export function VazioAprovadas({
  filtrando,
  total,
  onLimpar,
}: {
  filtrando: boolean;
  total: number;
  onLimpar: () => void;
}) {
  if (!filtrando) {
    return (
      <Vazio
        Icone={CheckCircle2}
        tom={{ bg: "#e5efe8", fg: "#2f6b46" }}
        titulo="Nenhuma aprovada ainda"
        texto="O que for aprovado na aba Decidir aparece aqui, pronto para agendar."
      />
    );
  }
  return (
    <Vazio
      Icone={SearchX}
      tom={{ bg: "#eceee7", fg: "#6e7063" }}
      titulo="Nada com esses filtros"
      texto={`Nenhuma das ${total} aprovadas combina com o que está selecionado.`}
      acao={
        <Button variant="ghost" onClick={onLimpar} className="text-destructive">
          Limpar todos os filtros
        </Button>
      }
    />
  );
}

export function VazioAgenda({ pendentes }: { pendentes: number }) {
  return (
    <Vazio
      Icone={CalendarDays}
      tom={{ bg: "#e3edf1", fg: "#2f5b6f" }}
      titulo="Semana livre"
      texto={
        pendentes > 0
          ? `Nenhuma visita ou gravação marcada. Há ${pendentes} captaç${pendentes === 1 ? "ão" : "ões"} esperando agendamento.`
          : "Nenhuma visita ou gravação marcada, e nada pendente de agendamento."
      }
    />
  );
}

export function VazioRetornos({ suas }: { suas: boolean }) {
  return (
    <Vazio
      Icone={MessageSquareHeart}
      tom={{ bg: "#eef4f0", fg: "#2f6b46" }}
      titulo="Todo mundo avisado"
      texto={
        suas
          ? "Nenhum retorno pendente com você. Os proprietários das captações reprovadas já foram informados."
          : "Nenhum retorno pendente no time."
      }
    />
  );
}

export function VazioGravacoes({ periodo }: { periodo: string }) {
  return (
    <Vazio
      Icone={Video}
      tom={{ bg: "#eceee7", fg: "#6e7063" }}
      titulo={`Nenhuma gravação em ${periodo}`}
      texto="O contador fica em zero até a primeira gravação do período ser marcada como concluída."
    />
  );
}
