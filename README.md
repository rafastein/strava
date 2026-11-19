# Strava do Rafa

Painel pessoal de corrida: junta as atividades do Strava e o plano do COROS para mostrar treino do dia, volume da semana, carga, provas e recordes. Feito com Next.js 16 (App Router), pensado primeiro para o celular.

Em produção: https://stravadorafa.vercel.app

## Rodando localmente

Requer Node 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

Sem Redis, o site funciona em modo local: o token do Strava fica em `data/strava-token.json`. O plano do COROS, as provas cadastradas e as previsões manuais dependem do Redis e aparecem vazios.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | Compila `tests/` e roda com `node --test` |
| `npm run import:coros:schedule` | Envia uma agenda do COROS para o site (veja `docs/coros-import.md`) |

## Variáveis de ambiente

Todas estão descritas em `.env.example`. Em resumo:

- **Strava:** `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN` e a URL pública em `STRAVA_REDIRECT_URI` (ou `NEXT_PUBLIC_APP_URL`).
- **Redis/Upstash:** `KV_REST_API_URL` + `KV_REST_API_TOKEN`, ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- **Cron:** `CRON_SECRET`, que a Vercel envia nas chamadas do cron.
- **Admin:** `ADMIN_SECRET`. Em produção, sem ele todas as rotas que gravam dados recusam a requisição. O segredo vai no cabeçalho `x-admin-secret` ou em `Authorization: Bearer …`, nunca na URL. `REVALIDATE_SECRET` e `SITE_ADMIN_SECRET` ainda são aceitos como nomes antigos.

## Estrutura

A navegação tem cinco abas (barra inferior no celular, menu no topo no desktop):

- **Hoje** (`/`): treino do dia, semana com planejado × feito, próxima prova, carga e atividades recentes.
- **Treinos** (`/treinos`): histórico de 12 semanas de planejado × feito, além de `/longoes`, `/treinos-qualidade` e `/coros`.
- **Provas** (`/provas`): calendário e resultados, além de `/meias` e `/buenos-aires`.
- **Carga** (`/carga`): CTL, ATL e TSB.
- **Mais** (`/mais`): `/equipamentos`, `/27-capitais`, `/corridas-brasil`, `/corridas-mundo` e `/glossario`.

Pastas principais:

```txt
app/
  components/      componentes compartilhados (Navbar, TabBar, WeekDayBars, ui/…)
  lib/             regras e acesso a dados (Strava, COROS, carga, provas, formatação)
  styles/app.css   design system: tokens --ui-* e classes ui-*
  api/             rotas de escrita e dados sob demanda
data/              arquivos locais (previsões, agenda COROS de exemplo)
docs/              guias de manutenção
public/            fotos das capitais, logos de marcas e mapas GeoJSON
scripts/           importação do COROS e download das fotos das capitais
tests/             testes unitários (node:test)
```

## Como os dados chegam

- **Strava:** buscado no servidor, com cache de 5 minutos (tag `strava`). O botão de atualizar da home chama `/api/revalidate` para limpar o cache.
- **COROS:** o site é cliente do MCP oficial (`https://mcp.coros.com/mcp`). Em `/coros`, "Conectar COROS" faz o login OAuth (registro automático do app + PKCE); o refresh token fica no Redis (`coros:oauth`). A agenda (`queryTrainingSchedule`, duas semanas para trás e cinco à frente) é gravada como `planned-workout:AAAA-MM-DD`:
  - todo dia às 5h (cron da Vercel em `vercel.json`, protegido por `CRON_SECRET`);
  - ao abrir a home, se a última sincronização tiver mais de 3 horas (roda depois da resposta);
  - no botão "Sincronizar agora".
  Treino apagado no COROS some do site na sincronização seguinte. A importação manual (colar o texto) continua como plano B.

O plano de treino vem só do COROS: sem treino cadastrado, a semana aparece sem plano.

## Segurança

- As rotas de escrita exigem `ADMIN_SECRET`, comparado em tempo constante.
- As rotas de API que chamam o Strava sob demanda têm limite de requisições por IP.
- Os IDs de atividade são validados antes de qualquer chamada ao Strava.

## Antes de mexer no código

Esta versão do Next.js tem mudanças que quebram compatibilidade. Leia `AGENTS.md` e os guias em `node_modules/next/dist/docs/` antes de usar APIs de cache, fontes ou rotas.
