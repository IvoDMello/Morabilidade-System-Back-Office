import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactFilters } from "@/features/contacts/components/contact-filters";
import { ContactTable } from "@/features/contacts/components/contact-table";
import { ContactViewToggle } from "@/features/contacts/components/contact-view-toggle";
import { ContactPipelineBoard } from "@/features/contacts/pipeline/components/contact-pipeline-board";
import { getContacts } from "@/services/contacts.service";
import type { ContactCategory } from "@/constants/contact-categories";
import type { ContactStatus } from "@/constants/contact-status";
import type { NextAction } from "@/constants/next-actions";

interface ContatosPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    nextAction?: string;
    hasReminders?: string;
    isFavorite?: string;
    propertyId?: string;
    view?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function ContatosPage({ searchParams }: ContatosPageProps) {
  const params = await searchParams;
  const isPipeline = params.view === "pipeline";

  // Os mesmos filtros valem nas duas visões. O status era ignorado no Pipeline
  // ("a coluna já diz o status"), mas com o chip visível em ambas isso viraria
  // um controle que não faz nada: escolher "Documentação" e o board não mudar.
  // Filtrado, o board mostra só a coluna escolhida com cartões — que é
  // exatamente o que "filtrar por status" quer dizer.
  const contacts = await getContacts({
    search: params.search,
    category: params.category as ContactCategory | undefined,
    status: params.status as ContactStatus | undefined,
    nextAction: params.nextAction as NextAction | undefined,
    hasReminders: params.hasReminders === "1",
    isFavorite: params.isFavorite === "1",
    propertyId: params.propertyId,
    sortBy: params.sortBy as "name" | "updatedAt" | "createdAt" | undefined,
    sortDir: params.sortDir as "asc" | "desc" | undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden items-baseline gap-2.5 md:flex">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Contatos</h1>
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {contacts.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ContactViewToggle />
          <Button nativeButton={false} render={<Link href="/contatos/novo" />}>
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>

      <ContactFilters />

      {isPipeline ? (
        <ContactPipelineBoard
          contacts={contacts}
          statusFiltro={params.status as ContactStatus | undefined}
        />
      ) : (
        <ContactTable contacts={contacts} />
      )}
    </div>
  );
}
