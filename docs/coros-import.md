# COROS → Upstash

## Automático (padrão)

1. Em `/coros`, clique em **Conectar COROS** (pede a senha administrativa) e autorize na conta COROS.
2. A agenda passa a entrar sozinha: cron diário, abertura da home (se a última tiver mais de 3 h) e o botão **Sincronizar agora**.
3. O cartão "Conexão com o COROS" mostra a última sincronização e o erro, se houver.

Na Vercel, defina `CRON_SECRET` (valor aleatório) para o cron diário funcionar.

## Manual (plano B)

O fluxo abaixo continua valendo se a conexão falhar.

A página `/coros` e a página `/equipamentos` leem treinos estruturados das chaves:

```txt
planned-workout:YYYY-MM-DD
```

Sem a conexão automática, o caminho é:

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
