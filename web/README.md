# Web - Next.js + Neon

Dashboard de observabilidade do pipeline com autenticacao basica obrigatoria.

## Requisitos

- Node.js 20+
- `DATABASE_URL` (Neon)
- `DASHBOARD_BASIC_AUTH_USER`
- `DASHBOARD_BASIC_AUTH_PASSWORD`

## Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

## Comandos

```bash
npm run dev
npm run build
npm run test
```

## Rotas operacionais

- `/` dashboard principal (eventos ordenados por `created_at desc`, limite/paginacao)
- `/api/health` healthcheck simples (DB configurado e alcançavel)

## Segurança

- Sem `DASHBOARD_BASIC_AUTH_USER` e `DASHBOARD_BASIC_AUTH_PASSWORD`, o dashboard responde `401` por padrao.
