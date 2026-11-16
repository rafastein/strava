import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/weekly-plan.css";
// Novo sistema visual: fica por último para valer sobre as regras antigas no celular.
import "./styles/app.css";
import TabBar from "./components/TabBar";

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
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full">
        {children}
        <TabBar />
      </body>
    </html>
  );
}