import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { ContactContextPanel } from "@/features/contacts/components/contact-context-panel";
import { updateContactAction } from "@/app/contatos/actions";
import { getContactById } from "@/services/contacts.service";
import { getRemindersByContact } from "@/services/reminders.service";
import { getPropertiesByContact } from "@/services/properties.service";

interface EditarContatoPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarContatoPage({ params }: EditarContatoPageProps) {
  const { id } = await params;
  const contact = await getContactById(id);
  if (!contact) notFound();

  const [reminders, properties] = await Promise.all([
    getRemindersByContact(id),
    getPropertiesByContact(id),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Editar contato</h1>
        <p className="text-sm text-muted-foreground">{contact.name}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card className="lg:flex-1">
          <CardHeader>
            <CardTitle>Dados do contato</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm contact={contact} onSubmit={updateContactAction.bind(null, id)} />
          </CardContent>
        </Card>

        {/* Painel de contexto (FM-3): só em telas largas, para não competir com o formulário no mobile */}
        <div className="hidden lg:block lg:w-80 lg:shrink-0">
          <ContactContextPanel contact={contact} reminders={reminders} properties={properties} />
        </div>
      </div>
    </div>
  );
}
