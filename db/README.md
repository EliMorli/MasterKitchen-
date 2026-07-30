# db/

| File | What it is |
| --- | --- |
| `schema.sql` | The proposed Postgres schema. Explained in [docs/03](../docs/03-data-model.md). |
| `smoke-test.sql` | One realistic job pushed end to end through the model. |

**Nothing here has been applied to any real database.** It's a proposal for review.

## Verified

Both files were run against a scratch PostgreSQL 16 instance with `ON_ERROR_STOP=1`. The schema
applies clean, and the smoke test exercises the full lifecycle: intake → design → bidding →
quote → milestones → tasks → inspection → invoicing → payout → change order.

The smoke test is worth reading before the schema. It walks one job — a full remodel at 412 Maple
St for Ridgeline GC — through every table, and its output shows the views doing the work they
exist for:

- **Bid Board** — distinguishes *bid received* / *opened, no bid* / *not opened*, which is what
  turns chasing vendors into chasing one vendor
- **Open receivables** — excludes the paid invoice, buckets the overdue one by age
- **Today's schedule** — shows per task whether the rep and the crew have actually been told
- **Project thread** — both WhatsApp groups, inbound and outbound, senders identified
- **Service window** — which group can be messaged free-form and which needs a template
- **Needs attention** — agent suggestions, each citing the message that triggered it
- **Rule performance** — per-rule accept rate, the honest measure of whether the agent works
- **Margin** — the same quote shown as markup-on-cost and as gross margin, side by side

## Running it yourself

```sh
createdb mk
psql -d mk -v ON_ERROR_STOP=1 -f schema.sql
psql -d mk -v ON_ERROR_STOP=1 -f smoke-test.sql
```

Requires `pgcrypto` and `citext`, both standard on Supabase and in contrib.

## Before this becomes a real migration

Two open questions change values here — see [docs/09](../docs/09-open-questions.md):

- **#2, margin.** `org_setting.default_markup_pct` ships at 50 with markup-on-cost semantics
  (`price = cost × 1.5`). If "50%" was meant as gross margin, that default is wrong — the column
  stays, the number changes.
- **#4, milestone percentages.** `milestone_template.client_pct` and `payout_pct` ship null. The
  structures are right; the numbers were never specified.

The smoke test divides evenly by six purely to have numbers to test with. That is not a
recommendation.
