# Master Kitchen

Operations system for Master Kitchen — jobs, pricing, scheduling, invoicing and the
WhatsApp comms that hold it all together.

Next.js (App Router) + Supabase + Vercel. The spec it was built from is in
[`docs/`](docs/) and is still the reference for *why* things work the way they do.

## Running it

```sh
npm install
cp .env.example .env.local     # fill in the Supabase URL and anon key
npm run dev
```

| Command | |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run e2e` | full browser walkthrough against a running server |

The end-to-end test in [`tests/e2e.mjs`](tests/e2e.mjs) drives a real browser through the
whole business: sign in, add a client and rep, create a job, send the designer, put the
design out to bid, submit a vendor price from the tokenized portal, select it, price the
job, win it, reach a milestone, draft and send the invoice, schedule a task, post a crew
update through the job link, and watch the checks flag it. 25 assertions.

## The shape of it

| Screen | What it's for |
| --- | --- |
| **Dashboard** | Today's work, money at a glance, and what needs attention |
| **Outbox** | Every message waiting to go out, reviewed in one pass |
| **Schedule** | Mon–Sat week view; a day to a week out is normal |
| **Jobs** | One kitchen at one address, with tabs for bids, quote, schedule, money and comms |
| **Portal** | The Bid Board — who was asked, who opened it, who answered |
| **Money** | Receivables with aging, drafts waiting to send, crew payouts |
| `/bid/{token}` | Vendor's one page. No account. |
| `/j/{token}` | Crew's upload link, pinned in their WhatsApp group. No account. |

## Two things worth knowing before you read the code

**Nothing sends itself.** Scheduling a task, passing an inspection or reaching a
milestone all *draft* a message or an invoice; releasing it is a person pressing a
button. That is not timidity — it is how the owners described wanting to work, and an
agent that silently invoices a GC creates a problem no efficiency gain repays.

**Vendors and crews never log in.** They get a tokenized link, and the scoping lives in
the database rather than the app — see [`supabase/README.md`](supabase/README.md). There
is deliberately no service-role key in this codebase.

---

# The spec

The rest of this file is the discovery synthesis the app was built from. It is still
current, and still the place to look when a decision seems arbitrary.

## What Master Kitchen does

Master Kitchen sits between general contractors and the crews/vendors who do kitchen work.
A GC's sales rep sells a kitchen; Master Kitchen designs it, prices it, subs it out, schedules
it, and runs the communication in both directions. They never talk to the homeowner. Today
the entire business runs on WhatsApp (~40 active groups) plus a shared Google Sheet, with no
other software of any kind.

Two job types, roughly 50/50 and not known at intake:

- **Install only** — cabinets and countertops.
- **Full remodel** — demo, plumbing, electrical, inspections, cabinets, countertops.

Volume is ~20 jobs/month and growing. Users are the two owners, plus two receptionists
("data loggers") joining later. Web/laptop first.

## The two problems worth solving

Stated directly by the owner: **automate the invoicing and the communication.** Everything
in this spec is ordered around those two, and the rest is scaffolding that makes them possible.

## Read in this order

| Doc | What it covers |
| --- | --- |
| [00 — Discovery answers](docs/00-discovery-answers.md) | The source answers, recorded verbatim |
| [01 — How the business works](docs/01-how-the-business-works.md) | Operating model, glossary, actors |
| [02 — Job lifecycle](docs/02-job-lifecycle.md) | The state machine every job moves through |
| [03 — Data model](docs/03-data-model.md) | Entities, relationships, ERD |
| [04 — Pricing and the bid portal](docs/04-pricing-and-bidding.md) | Cost build-up, margin, vendor portal |
| [05 — Scheduling](docs/05-scheduling.md) | Tasks, slots, crew assignment, inspections |
| [06 — Invoicing and payouts](docs/06-invoicing-and-payouts.md) | Milestones, AR, paying subs |
| [07 — WhatsApp architecture](docs/07-communications.md) | **Groups, the inbox, cost — read this one carefully** |
| [08 — Crew job links](docs/08-crew-job-links.md) | The per-job photo/update upload link |
| [09 — Open questions](docs/09-open-questions.md) | What still has to be answered before build |
| [10 — Build plan](docs/10-build-plan.md) | Phasing, MVP scope, stack recommendation |
| [11 — The message agent](docs/11-message-agent.md) | The AI layer reading the threads |
| [db/schema.sql](db/schema.sql) | Proposed Postgres schema (not applied anywhere yet) |

## Three things to look at before anything gets built

1. **The WhatsApp number is the critical path.** The decision is to go straight to the Groups
   API, which requires an Official Business Account and **does not work on WhatsApp Business app
   numbers**. That application has an unpredictable lead time and gates every group feature —
   start it before any code. Everything else in the build proceeds in parallel. See
   [09 #0](docs/09-open-questions.md) and [07](docs/07-communications.md).
2. **Groups link by ID, never by name.** The system creates each project's groups through the
   API and stores the returned group ID on the project, so routing an inbound message is a
   primary-key lookup. Names (`MK-0142 · 412 Maple St · Sales`) are for humans and can be
   changed without breaking anything. The corollary: groups must never be created by hand.
3. **"50%" needs one sentence of clarification.** Margin is a percentage, ~50%, always
   editable — settled. But 50% *markup on cost* and 50% *gross margin* differ by $17,600 on a
   $35,200 job. The quote screen shows both live so it can't cause a mistake; it only decides
   which is seeded as the default. See [04](docs/04-pricing-and-bidding.md).

## Status

Discovery synthesized and revised after the WhatsApp architecture decision. No stack chosen, no
code written, no infrastructure provisioned. [Doc 10](docs/10-build-plan.md) proposes the first
slice.
