# Tech Debt Tracker

Track known technical debt items, their impact, and resolution priority.

## Priority Legend
- **P0**: Blocking — must fix before next release
- **P1**: High — fix within current sprint
- **P2**: Medium — schedule for near-term
- **P3**: Low — fix when convenient

## Active Debt

| ID | Priority | Domain | Description | Impact | Created |
|----|----------|--------|-------------|--------|---------|
| TD-001 | P1 | Testing | No automated tests for any domain | Regressions caught only in production | 2026-03 |
| TD-002 | P1 | API | No Zod input validation on API routes | Invalid data can reach DB layer | 2026-03 |
| TD-003 | P2 | Observability | Console.log only, no structured logging | Hard to debug production issues | 2026-03 |
| TD-004 | P2 | Security | Debug routes (`/api/debug/*`) exposed in production | Data leak risk | 2026-03 |
| TD-005 | P2 | Payments | TON payments require manual confirmation | Poor user experience | 2026-03 |
| TD-006 | P3 | WeChat Pay | Webhook not tested in production | May fail on real payments | 2026-03 |
| TD-007 | P3 | Frontend | No loading states on some web pages | Perceived performance issues | 2026-03 |
| TD-008 | P3 | API | Rate limiting not implemented | Abuse potential | 2026-03 |

## Resolved Debt

| ID | Resolution | Date |
|----|-----------|------|
| TD-000 | Stripe webhook secret mismatch — fixed by correcting Vercel env var | 2026-03-19 |
