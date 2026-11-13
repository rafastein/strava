// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import LongoesDashboard from "./_components/LongoesDashboard";

export default function LongoesPage() {
  return <LongoesDashboard />;
}
