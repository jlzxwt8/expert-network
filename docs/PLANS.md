# Plans & Roadmap

## Current Priorities

1. **Stability**: Ensure Stripe webhooks, payment flows, and notifications are reliable across all platforms
2. **WeChat Mini Program**: Polish UX, pass WeChat review for public release
3. **AI matching**: Improve expert recommendation quality with richer context
4. **Growth**: SEO, sharing features, referral mechanics

## Upcoming Work

- [ ] WeChat Mini Program public release (pending WeChat review)
- [ ] Expert earnings dashboard (view payouts, transaction history)
- [ ] Group sessions / workshop booking support
- [ ] Multi-language support (English, Chinese, Malay)
- [ ] Push notifications for booking reminders

## Recently Completed

- [x] Stripe live mode integration with Connected Accounts
- [x] WeChat Mini Program MVP with full feature parity
- [x] Multi-provider AI system (Qwen, Gemini, OpenAI)
- [x] Two-way review system (founder rates expert, expert suggests)
- [x] Free booking flow for experts with zero pricing
- [x] Stripe webhook fix (secret mismatch on Vercel)

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03 | Switch primary DB to Supabase PostgreSQL | TiDB cold-start timeouts in serverless |
| 2026-03 | Use Qwen as primary AI in production | Better Chinese language support for SEA market |
| 2026-03 | Remove WhatsApp integration | Low adoption, maintenance burden |
| 2026-03 | Stripe Express Connect for experts | Simplest marketplace payout model |

See [docs/exec-plans/](exec-plans/) for detailed execution plans.
