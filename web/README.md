# Web — Next.js + Tailwind + Neon

## Requisitos

- Node.js 20+
- Conta [Neon](https://neon.tech) e string `DATABASE_URL`

## Setup

```bash
cd web
cp .env.example .env.local
# edite DATABASE_URL
npm install
npm run db:push
npm run dev
```

## Tema

Cores e raios semânticos: `theme/tokens.ts` → referenciados em `tailwind.config.ts`. Use classes Tailwind (`bg-background`, `text-foreground`, `border-border`, `text-accent`, etc.) nos componentes.

## Autenticação

Não implementada nesta versão (conforme plano).
