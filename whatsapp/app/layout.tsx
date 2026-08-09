import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { ConditionalShell } from "@/components/layout/conditional-shell";
import { ZoomLock } from "@/components/layout/zoom-lock";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getReminderCounts } from "@/services/dashboard.service";
import { getPendingConversationsCount, getUnreadConversationsCount } from "@/services/whatsapp.service";
import type { NavCounts } from "@/constants/nav";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  // Zoom travado a pedido do produto: o app é usado como PWA no celular, e o
  // pinch acidental durante a rolagem deixava a tela torta sem jeito óbvio de
  // desfazer. Decisão consciente contra a WCAG 1.4.4 — quem precisa ampliar
  // depende do zoom do sistema operacional. Só o meta não basta: ver
  // `touch-action` no globals.css e o <ZoomLock /> para o Safari do iOS.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Contadores dos selos da navegação. Não é awaited aqui de propósito: são três
 * consultas ao Supabase, e esperá-las segurava TODO o HTML — a tela só começava
 * a aparecer depois delas. Agora a promise desce até os selos, que suspendem
 * sozinhos enquanto o resto do app já está na tela e clicável.
 *
 * Falha aqui não pode derrubar a página: sem error boundary na raiz, uma
 * promise rejeitada lida com `use()` quebraria o app inteiro por causa de um
 * contador. Um soluço no banco zera os selos e nada mais. */
function loadNavCounts(): Promise<NavCounts> {
  return Promise.all([
    getReminderCounts(),
    getUnreadConversationsCount(),
    getPendingConversationsCount(),
  ])
    .then(([reminderCounts, unreadConversations, pendingConversations]) => ({
      reminderCounts,
      unreadConversations,
      pendingConversations,
    }))
    .catch((error): NavCounts => {
      console.error("[layout] falha ao carregar contadores da navegação:", error);
      return {
        reminderCounts: { pending: 0, overdue: 0 },
        unreadConversations: 0,
        pendingConversations: 0,
      };
    });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const countsPromise = loadNavCounts();

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <ZoomLock />
          <ConditionalShell countsPromise={countsPromise}>{children}</ConditionalShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
