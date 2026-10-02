# Payouts (read only)

Payouts over MCP are read-only. Starting, initiating, canceling or reinstating payouts happens in the viral.app dashboard (Creator Hub, Payouts).

## Which tool

| Question | Tool | Units |
| --- | --- | --- |
| "Do I owe anything?" | `get_payout_counts` (upcoming, due, canceled, paid) | counts |
| What is owed now (finished billing periods not paid yet) | `list_due_payouts` | MINOR (`payoutAmount` / 10^`payoutPrecision`) |
| What becomes due next (running periods) | `list_upcoming_payouts` | MINOR |
| What was paid | `list_paid_payouts` | MAJOR |
| Why a paid payout has this amount | `get_payout_breakdown` (stored snapshot and invoiced lines) | MAJOR |
| What one creator would get for one window | `calculate_payout_preview` | as returned |

- In due and upcoming rows, `payoutAmount` is what is LEFT to pay; `partialsPaid.amount`, `coveredAmount` and `calculatedAmount` describe earlier partial payments. Divide by 10^`payoutPrecision` before showing amounts.
- Billing-period bounds carry an offset (`+00:00`): compare them as timestamps.
- `calculate_payout_preview` runs live analytics: call it once per creator and window the user asks about, never in loops. It never pays anything.

## Typical answers

- **Payout overview**: `get_payout_counts`, then `list_due_payouts` grouped by campaign and currency with totals in major units, oldest first.
- **Creator dispute** ("why did I only get X?"): `list_paid_payouts` for the creator, `get_payout_breakdown` for the payout, `get_campaign` for the terms in sentences, `get_creator_history` for views in the period. Explain line by line; do not promise changes.
- **Forecast**: `list_upcoming_payouts` plus `get_campaign_activity` for pace.
- **Payout hold**: when assignments or payouts mention `payout_hold`, the organization has overdue creator payouts; settling them in the dashboard lifts the hold.

When the user asks to pay, settle, cancel or reinstate, explain that it is dashboard-only and offer the numbers they need to do it there.
