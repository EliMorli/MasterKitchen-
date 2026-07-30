# 10 — Build plan

## What success looks like

Q67: **automate the invoicing and the communication.** Two things. Everything else in this spec
exists to make those two possible.

A concrete target for the first release: the owners' morning goes from *composing forty WhatsApp
messages from memory across forty groups* to *reviewing a prepared list and releasing it* — and
money owed to them is a screen instead of a recollection.

## Sequencing principle

The business currently runs on **nothing but WhatsApp and a Google Sheet** (Q66). That cuts both
ways: there's no migration and no integration burden, but there's also no existing tool holding
things together if the new one is half-built. Each phase must be independently useful on the day
it ships.

## Phase 1 — The spine and the money (the MVP)

Everything a job needs to exist, plus the invoicing half of Q67.

**Build**
- Client companies, contacts (reps), partners
- Projects: intake → design → quote → won → scheduled → in progress → complete → closed
- Design record with file attachments, both in-house and client-supplied paths
- Quoting: cost lines, adjustments, margin, one flat price
- Milestones from templates per job type
- Invoices: auto-drafted at milestones, PDF, sequential numbering, terms and due dates
- **Receivables screen** — outstanding, overdue, aging, by client
- Payouts to partners at milestones
- Basic scheduling: tasks with date + AM/PM/full-day, week view, crew assignment
- Users: owner and logger roles

**Deliberately not yet:** the bid portal, any WhatsApp automation, crew links.

**Why this first:** invoicing is half the stated goal and depends on nothing external. No Meta
approval, no vendor onboarding, no behavior change from anyone outside the company. It can ship
and pay for itself while the harder parts are still in flight.

**Prerequisites:** open questions [#2 (margin)](09-open-questions.md) and
[#4 (milestone percentages)](09-open-questions.md) must be answered.

## Phase 2 — Communication and the portal

The other half of Q67, plus the thing the owner described most concretely.

**Build**
- Message templates and the drafting engine
- **The Outbox** — the daily review-and-release queue ([07](07-communications.md))
- Transport A: copy button and `wa.me` deep links, working with all existing groups
- Triggers: schedule confirmed, rescheduled, inspection passed, milestone reached, design ready
- **Bid portal** — vendor single page, owner Bid Board ([04](04-pricing-and-bidding.md))
- Selected bids flow into quote cost lines
- Change orders with approval channel and evidence capture
- Inspections with pass/fail and the auto-prompt to schedule next + notify rep

**Why together:** they share the tokenized-link infrastructure, and both are pure additions to a
system already running.

**Parallel track, starting now:** begin the Official Business Account application. It gates
Phase 3 and has an unpredictable timeline — see [#12](09-open-questions.md).

## Phase 3 — True automation

**Build**
- WhatsApp Cloud API integration, group creation per project, invite links
- Automatic send from the Outbox once approved
- Inbound webhooks putting replies on the project timeline
- **Crew job links** with photo upload, auto-pinned in the group
  ([08](08-crew-job-links.md))
- `extra work` uploads becoming pending change orders

**Gate:** OBA approval. Existing projects stay on Transport A permanently; new projects use the
API. No migration event.

## Phase 4 — What the data makes possible

Only worth building once there's a year of real records:

- Reschedule frequency and causes ([#8](09-open-questions.md), currently unknown)
- Which GCs pay slowly
- Which partners bid competitively and deliver on time
- Actual realized margin vs quoted, by job type
- Whether the implicit pricing rules can become a rate card

None of this is speculative feature-building — each item answers a question the owners couldn't
answer during discovery because nothing was ever recorded.

## Stack recommendation

Two owners plus two receptionists, web-first (Q63), ~20 jobs/month growing. Small scale, high
iteration speed, no existing systems to integrate with.

| Layer | Recommendation | Why |
| --- | --- | --- |
| Database | **Postgres (Supabase)** | Schema is relational and already written; auth, storage, and row-level security included |
| Files | **Supabase Storage** | Designs and job photos; signed URLs suit tokenized links |
| App | **Next.js (App Router) + TypeScript** | One deployable for the internal app, the vendor portal, and the crew page |
| UI | **Tailwind + shadcn/ui** | Fast to build a dense internal tool that doesn't look like one |
| Hosting | **Vercel** | Matches the app; no ops burden for a four-person company |
| Email | Resend or Postmark | Invoice delivery |
| WhatsApp | Cloud API direct, or a BSP | Evaluate at Phase 3 against the OBA requirement |
| PDFs | React-PDF or a headless-Chrome renderer | Invoices |

This is a recommendation, not a decision — the spec in this repo is stack-independent and
[`db/schema.sql`](../db/schema.sql) is plain Postgres.

## Things worth getting right early

**The Outbox is the product.** If the daily review queue is fast and trustworthy, the system
becomes the place the owners start their day. If it's slow or wrong, they go back to WhatsApp and
nothing else in here matters.

**Speed of intake.** A job arrives as one WhatsApp message. Creating the project must take under
thirty seconds — address, company, rep, done. If intake is a chore it gets skipped, and a skipped
project is invisible to every other feature.

**Design files, one click away.** Q57 says what they scroll back for is the design and the prices.
Both should be on the project page, always, with no hunting.

**Don't over-model the price.** The design plus experience produces the number
([04](04-pricing-and-bidding.md)). Record it; don't try to compute it.

**Loggers can't see money.** Two receptionists are coming (Q62). Margin, payouts, and partner
costs should be owner-only from the first release, not retrofitted.

## Risks

| Risk | Mitigation |
| --- | --- |
| OBA never approved, or the number can't move to Cloud API | Transport A works forever; the automation degrades to one tap, not zero |
| Owners keep using WhatsApp directly and the system goes stale | Outbox must be faster than typing; intake under 30 seconds |
| Vendors ignore the bid portal and want the sheet back | Link opens with no login, prefilled; keep manual bid entry as a fallback |
| Margin rule stays undefined | Free-text override on every quote so the screen never blocks a real job |
| Growth outpaces the build | Phase 1 alone handles well past 20 jobs/month |
