import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Captações · Morabilidade",
  description: "Kanban de captações de imóveis",
  manifest: "/manifest.webmanifest",
  // iOS: abre em tela cheia (standalone) ao "Adicionar à tela inicial".
  appleWebApp: {
    capable: true,
    title: "Captações",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#585a4f", // olive — barra do navegador no mobile
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <RegisterSW />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
