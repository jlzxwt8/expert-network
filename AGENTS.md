# AGENTS.md — Expert Network

> This file is the **table of contents** for agents working in this repo.
> It is intentionally short (~100 lines). Detailed docs live in `docs/`.

## Quick Start

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: Prisma 7 with PostgreSQL (Supabase) or MySQL (TiDB), switched via `DB_PROVIDER`
- **Hosting**: Vercel (serverless)
- **Clients**: Web browser, Telegram Mini App, WeChat Mini Program (Taro)

## Repository Layout

```
AGENTS.md            ← You are here
ARCHITECTURE.md      ← Domain map, dependency layers, tech decisions
docs/                ← Full knowledge base (see below)
prisma/              ← Database schema and migrations
scripts/             ← Build-time helpers (switch-db, wechat-upload)
src/
  app/               ← Next.js pages + API routes
  components/        ← React components (shadcn/ui primitives in ui/)
  lib/               ← Core business logic, integrations, AI providers
  hooks/             ← Custom React hooks
wechat/              ← WeChat Mini Program (Taro + React)
```

## Documentation Map

See `docs/` for full details:

| Document | Location | What it covers |
|----------|----------|----------------|
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) | Domains, layers, dependency rules |
| Design system | [docs/DESIGN.md](docs/DESIGN.md) | UI conventions, component patterns |
| Frontend | [docs/FRONTEND.md](docs/FRONTEND.md) | Page structure, routing, state |
| Plans | [docs/PLANS.md](docs/PLANS.md) | Current roadmap and priorities |
| Product sense | [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | User personas, product principles |
| Quality | [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) | Per-domain quality grades |
| Reliability | [docs/RELIABILITY.md](docs/RELIABILITY.md) | Error handling, SLOs, monitoring |
| Security | [docs/SECURITY.md](docs/SECURITY.md) | Auth, data handling, secrets |
| Design docs | [docs/design-docs/](docs/design-docs/) | Indexed design decisions |
| Exec plans | [docs/exec-plans/](docs/exec-plans/) | Active plans, completed, tech debt |
| Product specs | [docs/product-specs/](docs/product-specs/) | Feature specifications |
| References | [docs/references/](docs/references/) | LLM-friendly external references |
| Generated | [docs/generated/](docs/generated/) | Auto-generated DB schema docs |

## Key Conventions

1. **Authentication**: All API routes use `resolveUserId(request)` from `src/lib/request-auth.ts` — supports NextAuth, Telegram, and WeChat in one call.
2. **AI providers**: Swappable via `AI_PROVIDER` env var (`gemini`, `qwen`, `openai`). See `src/lib/ai/index.ts`.
3. **Payments**: Stripe (primary), TON (crypto), WeChat Pay. Webhook at `/api/webhooks/stripe`.
4. **Database switching**: Run `node scripts/switch-db.mjs` — reads `DB_PROVIDER` and patches `prisma/schema.prisma`.
5. **WeChat Mini Program**: Lives in `wechat/`, built with Taro. Uses the same backend API with `x-wechat-token` auth header.

## Coding Standards

- Parse data at boundaries — validate inputs with Zod or runtime checks
- Prefer shared utilities in `src/lib/` over hand-rolled helpers
- API routes return `NextResponse.json()` with consistent error shapes
- Use `export const maxDuration` for long-running serverless functions
- All notification calls (Telegram, WeChat) must be `.catch(() => {})` to not block responses

## Where to Look

| Task | Start here |
|------|-----------|
| Add a new API endpoint | `src/app/api/` — follow existing route patterns |
| Modify database schema | `prisma/schema.prisma` then `prisma generate` |
| Change AI behavior | `src/lib/ai/` — edit the relevant provider |
| Update WeChat Mini Program | `wechat/src/pages/` |
| Add a new business domain | See [ARCHITECTURE.md](ARCHITECTURE.md) for layer rules |
| Fix a payment issue | `src/lib/stripe.ts`, `src/app/api/webhooks/stripe/` |
| Update product specs | `docs/product-specs/` |
