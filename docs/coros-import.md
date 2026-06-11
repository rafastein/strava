# Importação COROS → Upstash

A página `/coros` e a página `/equipamentos` leem treinos estruturados das chaves:

```txt
planned-workout:YYYY-MM-DD
```

O MCP do COROS ainda não roda dentro da Vercel. Por isso o fluxo seguro é:

```txt
COROS MCP → agenda normalizada → /api/coros/import-schedule → Upstash → /coros e /equipamentos
```

## Importar o arquivo salvo no projeto

O arquivo inicial com a agenda retornada pelo MCP está em:

```txt
data/coros-training-schedule-2026-06-11.json
```

Ele inclui a regra pedida para 13/06:

```json
{
  "preferredTitlesByDate": {
    "2026-06-13": "Longão 23k"
  }
}
```

Assim, quando houver duplicidade em 13/06, o treino escolhido será `Longão 23k`.

## Rodar contra o site local

```bash
npm run dev
ADMIN_SECRET=sua_senha npm run import:coros:schedule -- --url http://localhost:3000
```

## Rodar contra a Vercel

```bash
ADMIN_SECRET=sua_senha npm run import:coros:schedule -- --url https://seu-site.vercel.app
```

## Testar sem salvar

```bash
ADMIN_SECRET=sua_senha npm run import:coros:schedule -- --url https://seu-site.vercel.app --dry-run
```

## Payload aceito pela API

A rota protegida é:

```txt
POST /api/coros/import-schedule
Header: x-admin-secret: ADMIN_SECRET
```

Ela aceita `entries` estruturadas:

```json
{
  "preferredTitlesByDate": { "2026-06-13": "Longão 23k" },
  "entries": [
    {
      "date": "2026-06-13",
      "title": "Longão 23k",
      "distanceKm": 23,
      "estimatedTime": "2:07:33",
      "loadTl": 203
    }
  ]
}
```

Ou o texto bruto retornado pelo MCP:

```json
{
  "text": "Training Schedule\n========================\n\n2026-06-13\nLongão 23k\nDistance: 23.00 km\nEstimated Time: 2:07:33\nLoad: 203 TL"
}
```
