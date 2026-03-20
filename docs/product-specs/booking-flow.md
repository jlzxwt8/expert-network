# Product Spec: Booking Flow

**Status**: Shipped

## User Story

As a founder, I want to book a consulting session with an expert by selecting a time slot and paying a deposit.

## Flow

1. View expert profile → click "Book Session"
2. Select date from horizontal date picker (next 14 days)
3. Select time slot(s) — 30-minute increments from expert's weekly schedule
4. Choose session type (online/offline) if expert supports both
5. For online: provide meeting link (Zoom, Google Meet, etc.)
6. For offline: view expert's location
7. Review summary: total price, 50% deposit, session details
8. Pay deposit via Stripe Checkout (PayNow, GrabPay, Card)
9. Redirect to success page → booking confirmed
10. Remainder auto-charged 24h after session

## Requirements

- Slots generated from expert's `weeklySchedule` if no explicit `AvailableSlot` records
- Multi-slot selection for longer sessions
- Overlap detection prevents double-booking
- Meeting link required before payment for online sessions
- Free bookings skip payment and create booking directly

## Edge Cases

- Expert has no availability set → show empty state with message
- All slots for today are in the past → filter them out
- User tries to book their own profile → blocked with error
- Stripe webhook fails → verify endpoint on success page creates booking
