import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Morabilidade — Sistema de Gestão",
  description: "Painel administrativo interno da imobiliária Morabilidade.",
  icons: {
    icon: "/favcon_Mora.png",
    shortcut: "/favcon_Mora.png",
    apple: "/apple-touch-icon.png",
  },
  // Instalado na tela inicial do iOS, abre em tela cheia (sem barra do Safari).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Morabilidade",
  },
  // Tag legada da Apple (iOS mais antigos) além da moderna mobile-web-app-capable.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#585a4f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
