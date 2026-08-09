import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import { ZoomLock } from "@/components/ZoomLock";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"], variable: "--font-serif" });

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
  themeColor: "#585a4f", // olive, barra do navegador no mobile
  width: "device-width",
  initialScale: 1,
  // Zoom travado a pedido do produto: o pinch acidental durante a rolagem do
  // board deixava a tela torta sem jeito óbvio de desfazer. Decisão consciente
  // contra a WCAG 1.4.4 — quem precisa ampliar depende do zoom do sistema
  // operacional. Só o meta não basta: ver `touch-action` e `overflow-x` no
  // globals.css e o <ZoomLock /> para o Safari do iOS.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} ${inter.className}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ZoomLock />
        {children}
        <RegisterSW />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
