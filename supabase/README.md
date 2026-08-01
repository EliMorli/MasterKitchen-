# supabase/

Live project: **`masterkitchen`** — ref `oyyasackypbohstxqmnn`, region `us-east-1`.

## v2

The v1 schema (29 tables modeling a workflow) was dropped in
`v2_reset_drop_everything` and replaced with 12 tables modeling a simple
progression. `migrations/` holds the repo copies of everything applied since:

| Applied | Name |
| --- | --- |
| 20260731031527 | `v2_reset_drop_everything` |
| 20260731031617 | `v2_schema` |
| 20260731034605 | `url_safe_tokens` |
| 20260731052010 | `payments_activity_whatsapp_pulse` |
| 20260731063857 | `storage_update_policy_and_portal_docs` |
| 20260731234321 | `price_request_doc_attachments` |
| 20260801024255 | `audit_harden_url_token_and_fk_indexes` |

The heart of it is one enum:

```
phase: new → design → pricing → approved → in_progress → complete → paid
```

`project.phase` drives the kanban board and the stage strip. Children are flat
and editable: `event` (calendar), `invoice`, `expense`, `change_order`,
`document`, `price_request`. Directory: `client_company`, `contact`, `partner`.
Plus `user_account` and `org_setting`.

The fourth migration adds the money-and-story layer: `payment` (invoice
status derives from payments, never set by hand), `activity` (each job's
auto-written log — the portal RPCs and `wa_ingest` write to it too), and
`wa_message` (raw WhatsApp Cloud API traffic, matched to a job by group id).
`project` gains `crew_rating` (1–3) and the per-job WhatsApp group ids;
`org_setting` gains the business identity printed on invoice PDFs and
`wa_verify_token`, which doubles as the webhook's shared secret for
`wa_ingest` — still no service-role key anywhere.

## Access

One team, one policy: any signed-in staff member can do anything. The `role`
column (owner / logger) stays for later, but v2 doesn't split visibility — the
point is that the data loggers run the whole business.

Vendors and crews never log in. They reach two token-scoped pages served by
four `portal_*` functions (the only things `anon` can execute), and the token
check lives in the database — there is no service-role key in the app.
Tokens are base64url (`url_token()`), because they live in URL paths.

## The /supa rewrite

The browser talks to Supabase through a same-origin `/supa/*` rewrite (see
`next.config.ts`), proxied by the Next server. One origin for everything, and
the auth cookie name is pinned in `lib/supabase/cookie.ts` so the server and
browser clients agree on it.

## After schema changes

Regenerate `lib/database.types.ts` — the app is typed against it end to end.
