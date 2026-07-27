import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { StatusBadge } from "@/features/contacts/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { Contact } from "@/types/contact";

export function RecentContacts({ contacts }: { contacts: Contact[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos contatos atualizados</CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum contato cadastrado" />
        ) : (
          <ul className="flex flex-col divide-y">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-3 py-2.5">
                <AvatarInitials name={contact.name} size="md" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/contatos/${contact.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {contact.name}
                  </Link>
                  <div className="mt-1 flex gap-1.5">
                    <CategoryBadge category={contact.category} />
                    <StatusBadge status={contact.status} />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(contact.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
