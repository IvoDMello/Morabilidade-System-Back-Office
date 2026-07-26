import Link from "next/link";
import { ArrowLeft, Ban, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { StatusBadge } from "@/features/contacts/components/status-badge";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPhone } from "@/lib/utils";
import type { Contact } from "@/types/contact";

/** Cabeçalho sticky da thread (CV-3): identidade do contato sempre visível
 * durante a rolagem de conversas longas, com atalho para a ficha completa. */
export function ConversationThreadHeader({ contact }: { contact: Contact }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-3">
      <Link href="/" className="shrink-0 md:hidden" aria-label="Voltar para a lista">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <AvatarInitials name={contact.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/contatos/${contact.id}`} className="truncate font-semibold hover:underline">
            {contact.name}
          </Link>
          <Link
            href={`/contatos/${contact.id}`}
            className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:flex"
          >
            Ver ficha completa
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <p className="truncate text-xs text-muted-foreground">{formatPhone(contact.phone)}</p>
      </div>
      {contact.isBlocked && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <Ban className="h-3 w-3" />
          Bloqueado
        </span>
      )}
      <div className="hidden items-center gap-1.5 sm:flex">
        <CategoryBadge category={contact.category} />
        <StatusBadge status={contact.status} />
      </div>
      <WhatsAppButton phone={contact.phone} className="hidden lg:flex" />
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        render={<a href={buildWhatsAppUrl(contact.phone)} target="_blank" rel="noopener noreferrer" />}
        className="lg:hidden"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}
