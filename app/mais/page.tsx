import HubPage from "../components/ui/HubPage";

export const metadata = { title: "Mais · Rafael Cabral" };

export default function MaisPage() {
  return (
    <HubPage
      title="Mais"
      description="Equipamentos, mapas e referência."
      links={[
        { href: "/equipamentos", label: "Tênis", description: "Km, desgaste e eficiência por tênis." },
        { href: "/27-capitais", label: "27 Capitais", description: "O desafio de correr em todas as capitais." },
        { href: "/corridas-brasil", label: "Corridas pelo Brasil", description: "Mapa com corridas por estado." },
        { href: "/corridas-mundo", label: "Corridas pelo mundo", description: "Mapa-múndi com corridas por país." },
        { href: "/glossario", label: "Glossário", description: "O que significa cada métrica do site." },
      ]}
    />
  );
}
