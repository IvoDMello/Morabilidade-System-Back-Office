import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function WhatsAppButton({ phone, className }: { phone: string; className?: string }) {
  return (
    <Button
      className={className}
      nativeButton={false}
      render={<a href={buildWhatsAppUrl(phone)} target="_blank" rel="noopener noreferrer" />}
    >
      <MessageCircle className="h-4 w-4" />
      Abrir WhatsApp
    </Button>
  );
}
