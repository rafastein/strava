// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import CapitaisDashboard from "./_components/CapitaisDashboard";

export default function CapitaisPage() {
  return <CapitaisDashboard />;
}
