import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Morabilidade — Imóveis para Venda e Locação",
    template: "%s | Morabilidade",
  },
  description:
    "Encontre casas, apartamentos e imóveis disponíveis para venda e locação. A Morabilidade é sua imobiliária de confiança.",
  openGraph: {
    siteName: "Morabilidade",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <WhatsAppButton />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
