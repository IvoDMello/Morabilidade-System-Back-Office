"use client";

const NUMERO = process.env.NEXT_PUBLIC_WHATSAPP ?? "";

interface Props {
  codigo: string;
  titulo: string;
}

export function WhatsAppButtonImovel({ codigo, titulo }: Props) {
  if (!NUMERO) return null;

  const mensagem = `Olá! Tenho interesse no imóvel *${titulo}* (código *${codigo}*). Pode me dar mais informações?`;
  const href = `https://wa.me/${NUMERO}?text=${encodeURIComponent(mensagem)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp sobre este imóvel"
      className="fixed bottom-6 right-6 z-[60] flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      style={{ backgroundColor: "#25D366" }}
    >
      <WhatsAppIcon />
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className="w-7 h-7 fill-white"
      aria-hidden="true"
    >
      <path d="M16 2.9C8.8 2.9 3 8.7 3 15.9c0 2.3.6 4.6 1.8 6.6L3 29.1l6.8-1.8c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 2.9 16 2.9zm0 23.8c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1 1-3.9-.3-.4c-1.1-1.7-1.7-3.7-1.7-5.8 0-5.9 4.8-10.7 10.7-10.7S26.7 10 26.7 15.9 21.9 26.7 16 26.7zm5.9-8c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1s0-.5.2-.6l.5-.6c.1-.2.2-.3.3-.5s0-.4-.1-.5-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.1 3.1 1.3 3.3c.2.2 2.2 3.4 5.4 4.7.8.3 1.4.5 1.8.6.8.2 1.5.2 2 .1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.2.2-1.4-.1-.2-.3-.3-.6-.4z" />
    </svg>
  );
}
