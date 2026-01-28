# Billing Plans

Credits and subscription billing infrastructure.

## Documentation

The canonical documentation for the credits/billing system lives at **[docs/billing/](../../docs/billing/)**:

| Doc | Topic |
|-----|-------|
| [00-architecture-overview.md](../../docs/billing/00-architecture-overview.md) | System overview, data flow, key files index |
| [01-credit-model.md](../../docs/billing/01-credit-model.md) | Credit types, millicredits, balances, idempotency |
| [02-subscription-credits.md](../../docs/billing/02-subscription-credits.md) | Plan allocation, renewal, upgrade/downgrade |
| [03-credit-packs.md](../../docs/billing/03-credit-packs.md) | Pack purchase flow |
| [04-admin-gifts.md](../../docs/billing/04-admin-gifts.md) | Gift credits admin flow |
| [05-llm-usage-tracking.md](../../docs/billing/05-llm-usage-tracking.md) | Langgraph usage capture & persistence |
| [06-credit-charging.md](../../docs/billing/06-credit-charging.md) | ChargeRunWorker, cost calculation, consumption |
| [07-pre-run-authorization.md](../../docs/billing/07-pre-run-authorization.md) | Credit check middleware, 402 responses |
| [08-credit-exhaustion-ui.md](../../docs/billing/08-credit-exhaustion-ui.md) | Frontend store, modals, gating |
| [09-stripe-webhooks.md](../../docs/billing/09-stripe-webhooks.md) | Webhook handlers |
| [10-subscription-cancellation.md](../../docs/billing/10-subscription-cancellation.md) | Cancellation policy |
| [11-development-mode.md](../../docs/billing/11-development-mode.md) | CREDITS_DISABLED kill switch |
| [12-testing-guide.md](../../docs/billing/12-testing-guide.md) | Testing strategies |

## Archive

Previous plan documents have been moved to [archive/](./archive/).
