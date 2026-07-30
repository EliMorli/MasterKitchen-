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

## Phase 0 — Paperwork, starting now

Not code. These have external lead times and gate Phase 2, so they run from day one in parallel
with everything else.

- **Official Business Account application** — required for the Groups API
- **Number decision** — the Groups API doesn't work on WhatsApp Business *app* numbers, so the
  number either migrates to the Cloud API or a new one is provisioned
  ([09 #0](09-open-questions.md))
- **BSP vs direct Cloud API** — evaluated on inbound group webhooks, not outbound features
  ([09 #14](09-open-questions.md))
- **Message template submission** — Meta pre-approval also takes time; the list is in
  [07](07-communications.md)

If all of this lands early, Phase 2 is unblocked when it arrives. If it drags, nothing else stops.

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
and pay for itself while Phase 0 is still in flight.

**Prerequisite:** [#4, milestone percentages](09-open-questions.md). The margin question is
settled enough to build against — 50%, editable, both readings shown on screen.

## Phase 2 — WhatsApp and the portal

The other half of Q67.

**Build**
- Message templates and the drafting engine
- **The Outbox** — the daily review-and-release queue ([07](07-communications.md))
- Group creation per project with the naming convention, invite links out to rep and crew
- Send through the Cloud API; inbound group webhooks with sender identity
- **The Communication tab** — per-project thread, both groups, reply from the app, photos
  auto-filed, service-window indicator
- Triggers: schedule confirmed, rescheduled, inspection passed, milestone reached, design ready
- **Bid portal** — vendor single page, owner Bid Board ([04](04-pricing-and-bidding.md))
- Selected bids flow into quote cost lines
- Change orders with approval channel and evidence capture
- Inspections with pass/fail and the auto-prompt to schedule next + notify rep

**Gate:** Phase 0. If the OBA is delayed, everything here still ships — the Communication tab
degrades to compose-and-copy against the existing groups, and the transport swaps in later
without a rewrite.

**Rollout:** new projects only. The existing ~40 groups can't be adopted and simply run out as
those jobs finish. No cutover.

## Phase 3 — The agent and the crew links

**Build**
- Message ingest and extraction, running silently first ([11](11-message-agent.md))
- Two reconciliation rules only — "claimed done but not invoiced" and "unanswered question"
- The Attention panel and the global needs-attention queue
- Accept/dismiss tracking from day one, and expansion only where accept rates justify it
- **Crew job links** with photo upload, auto-pinned in the crew group
  ([08](08-crew-job-links.md))
- `extra work` uploads becoming pending change orders

**Why last:** the agent needs a flowing message stream to read, which Phase 2 produces. Shipping
it earlier means tuning against no data.

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
| WhatsApp | Cloud API direct, or a BSP | Must expose **inbound group webhooks** ([09 #14](09-open-questions.md)) |
| Transcription | Whisper or equivalent | Voice notes in crew groups ([11](11-message-agent.md)) |
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
| OBA never approved, or the number can't move to Cloud API | Everything except automatic send still ships; the Communication tab degrades to compose-and-copy — one tap, not zero |
| Reps or crews don't accept the group invites | The current process already creates a new group per project, so this is the habit they have; the invite just arrives as a link |
| A job needs more than 8 people in a group | Hard cap. Use a second crew group — never remove participants, since removed members **cannot rejoin** |
| The agent produces noise and gets ignored | Ship two rules, run extraction silently first, track accept rate per rule and retire what gets dismissed |
| Owners keep using WhatsApp directly and the system goes stale | They can — replies sync both ways. The app must never be the only way to answer a message |
| Vendors ignore the bid portal and want the sheet back | Link opens with no login, prefilled; keep manual bid entry as a fallback |
| Growth outpaces the build | Phase 1 alone handles well past 20 jobs/month |
