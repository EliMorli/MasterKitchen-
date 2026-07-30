# supabase/

The live project is **`masterkitchen`** — ref `oyyasackypbohstxqmnn`, region `us-east-1`.

## Applied migrations

| Version | Name |
| --- | --- |
| 20260730212413 | `core_types_people_projects_bidding_quoting` |
| 20260730212449 | `scheduling_money_comms_agent_links_audit` |
| 20260730212512 | `views_and_milestone_templates` |
| 20260730212529 | `row_level_security_and_storage` |
| 20260730212602 | `harden_function_grants_and_extension_schema` |
| 20260730214437 | `tokenized_portal_rpcs` |
| 20260730214617 | `portal_submit_bid_optional_args` |

The first three together are [`db/schema.sql`](../db/schema.sql), which stays the
annotated reference for the data model. The rest are in
[`migrations/`](migrations/) — they are the parts that only exist because this is
a real deployment: auth wiring, row level security, and the two public pages.

## Access model

Three tiers, and the middle one is the interesting one:

**Owners** see everything. **Data loggers** can run the jobs but not the money —
`bid`, `quote`, `quote_cost_line` and `payout` are owner-only at the row level,
so a logger cannot read what a crew charges or what the margin is even by
querying directly. The first account created becomes an owner; everyone after is
a logger until promoted in Settings.

**Vendors and crews have no account at all**, by design — they will not log in
(docs/09 #68). They reach a tokenized page, and the scoping lives in the database
rather than the app: `portal_get_bid`, `portal_submit_bid`, `portal_get_job` and
`portal_submit_upload` each resolve their token first and can only touch the one
row it belongs to. These four are the only functions `anon` may execute.

That choice is worth keeping. The obvious alternative — giving the app a
service-role key to serve those pages — means holding a secret that bypasses RLS
entirely, and a leak exposes the whole database. Here there is no such secret:
a leaked token exposes one job.

## Regenerating types

After any schema change, regenerate `lib/database.types.ts` — the app is typed
against it end to end, and a stale file shows up as `never` types rather than a
clear error.
