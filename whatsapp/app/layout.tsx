import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConditionalShell } from "@/components/layout/conditional-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getReminderCounts } from "@/services/dashboard.service";
import { getPendingConversationsCount, getUnreadConversationsCount } from "@/services/whatsapp.service";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WhatsApp Morabilidade",
  description: "CRM de atendimento via WhatsApp para operação imobiliária",
  icons: {
    icon: "/icons/icon-192.png",
    // iOS não aceita transparência no apple-touch-icon (cantos virariam
    // brancos) — usa a variante full-bleed e aplica a máscara do sistema.
    apple: "/icons/apple-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WhatsApp Morabilidade",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Não travar o zoom: bloquear pinch-zoom (maximumScale/userScalable) fere a
  // acessibilidade em mobile — usuários com baixa visão precisam ampliar.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [reminderCounts, unreadConversations, pendingConversations] = await Promise.all([
    getReminderCounts(),
    getUnreadConversationsCount(),
    getPendingConversationsCount(),
  ]);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <ConditionalShell
            reminderCounts={reminderCounts}
            unreadConversations={unreadConversations}
            pendingConversations={pendingConversations}
          >
            {children}
          </ConditionalShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
