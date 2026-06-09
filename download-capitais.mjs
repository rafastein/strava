// node download-capitais.mjs
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const OUT_DIR = "./app/public/capitais";

// Título do artigo na Wikipedia PT para cada capital
const WIKIPEDIA_TITLES = {
  bsb: "Congresso Nacional do Brasil",
  rio: "Cristo Redentor (estátua)",
  spo: "Museu de Arte de São Paulo",
  gyn: "Praça Cívica (Goiânia)",
  bhz: "Igreja de São Francisco de Assis (Pampulha)",
  cwb: "Jardim Botânico de Curitiba",
  cgr: "Parque das Nações Indígenas",
  cgb: "Catedral Basílica do Senhor Bom Jesus (Cuiabá)",
  aju: "Ponte Construtor João Alves",
  for: "Ponte dos Ingleses",
  jpa: "Farol do Cabo Branco",
  mcz: "Farol da Ponta Verde",
  nat: "Forte dos Reis Magos",
  rec: "Marco Zero do Recife",
  ssa: "Elevador Lacerda",
  slz: "Centro histórico de São Luís",
  the: "Ponte Estaiada João Isidoro França",
  bel: "Ver-o-Peso",
  bvb: "Monumento ao Garimpeiro",
  mcp: "Fortaleza de São José de Macapá",
  mao: "Teatro Amazonas",
  pmw: "Palácio Araguaia",
  pvh: "Estrada de Ferro Madeira-Mamoré",
  rbr: "Palácio Rio Branco (Acre)",
  vix: "Convento da Penha (Vitória)",
  fln: "Ponte Hercílio Luz",
  poa: "Usina do Gasômetro (Porto Alegre)",
};

async function getWikipediaImageUrl(title) {
  const encoded = encodeURIComponent(title);
  const url = `https://pt.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return page?.thumbnail?.source ?? null;
}

async function downloadImage(code, title) {
  try {
    process.stdout.write(`  ${code} (${title.substring(0, 30)})... `);
    const imgUrl = await getWikipediaImageUrl(title);
    if (!imgUrl) throw new Error("Sem imagem no artigo");

    const res = await fetch(imgUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    await writeFile(join(OUT_DIR, `${code}.jpg`), Buffer.from(buf));
    console.log(`✓ (${Math.round(buf.byteLength / 1024)}KB)`);
    return true;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    return false;
  }
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`\nBaixando ${Object.keys(WIKIPEDIA_TITLES).length} fotos via Wikipedia PT...\n`);

let ok = 0, fail = 0;
for (const [code, title] of Object.entries(WIKIPEDIA_TITLES)) {
  const success = await downloadImage(code, title);
  if (success) ok++; else fail++;
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\nPronto: ${ok} ✓  ${fail} ✗`);
