import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./styles/app.css";
import TabBar from "./components/TabBar";

// Fontes empacotadas no projeto (sem depender do Google Fonts): carregam junto com a
// página, sem pedido extra a outro domínio, e funcionam mesmo com a rede instável.
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard Strava · Rafael Cabral",
  description: "Análise de treinos, projeções e acompanhamento de corrida.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deixa o conteúdo usar a área do notch; a barra de abas respeita o safe-area.
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-full">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
