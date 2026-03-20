# Design Doc: Payment Architecture

**Status**: Accepted
**Date**: 2026-03
**Author**: Tony Wang

## Context

The marketplace needs to collect payments from founders and distribute to experts, supporting multiple payment methods across geographies.

## Decision

### Payment Methods
- **Stripe** (primary): Checkout Sessions for deposits, automated remainder charging
- **TON** (crypto): On-chain transfers via TonConnect for crypto-native users
- **WeChat Pay**: JSAPI for WeChat Mini Program users
- **Free sessions**: Direct booking creation for experts with zero pricing

### Marketplace Model
- Stripe Connected Accounts (Express type) for expert payouts
- Platform fee: configurable via `STRIPE_PLATFORM_FEE_PERCENT` (default 15%)
- Fee applied as `application_fee_amount` on Checkout Sessions

### Deposit Model
- 50% deposit charged at booking time
- Remainder auto-charged 24h after session ends (daily cron)
- Card saved via `setup_future_usage: "off_session"` for remainder

### Double-Write Pattern
Booking creation happens via two independent paths:
1. **Stripe webhook** (`checkout.session.completed`) — server-to-server
2. **Verify endpoint** (`/api/bookings/verify`) — browser calls after redirect

Both paths check for existing booking by `stripeCheckoutSessionId` to prevent duplicates.

## Consequences

- **Pro**: Booking creation is resilient to webhook delays or failures
- **Pro**: Connected Accounts handle KYC and payouts for experts
- **Con**: TON payments require manual confirmation (no webhook equivalent)
- **Con**: WeChat Pay webhooks need production testing
