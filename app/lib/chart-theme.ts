// Gráficos em canvas não herdam a fonte da página. As fontes do next/font recebem um nome
// gerado no build, então a família é lida da própria página na hora de desenhar.

type ChartWithDefaults = { defaults: { font: { family?: string }; color?: unknown } };

export function applyChartTheme(Chart: ChartWithDefaults) {
  if (typeof document === "undefined") return;
  const family = getComputedStyle(document.body).fontFamily;
  if (family) Chart.defaults.font.family = family;
  Chart.defaults.color = "#9ba1a9";
}
