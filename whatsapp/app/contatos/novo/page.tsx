import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { createContactAction } from "@/app/contatos/actions";

export default function NovoContatoPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="hidden md:block">
        <h1 className="font-heading text-2xl font-semibold">Novo contato</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo contato no CRM.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do contato</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm onSubmit={createContactAction} />
        </CardContent>
      </Card>
    </div>
  );
}
