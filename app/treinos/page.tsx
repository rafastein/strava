import HubPage from "../components/ui/HubPage";

export const metadata = { title: "Treinos · Rafael Cabral" };

export default function TreinosPage() {
  return (
    <HubPage
      title="Treinos"
      description="Análise dos treinos e o plano da semana."
      links={[
        { href: "/longoes", label: "Longões", description: "Pace, eficiência e evolução dos treinos longos." },
        { href: "/treinos-qualidade", label: "Treinos de qualidade", description: "Intervalados, fartleks e progressivos." },
        { href: "/coros", label: "Plano COROS", description: "Treinos estruturados e calendário planejado." },
        { href: "/sisrun", label: "SisRUN", description: "Planilha da assessoria: planejado × executado." },
      ]}
    />
  );
}
