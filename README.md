# Master Kitchen — System Spec

This repo holds the build specification for Master Kitchen's operations system, derived
from the discovery questionnaire answered by the owners (July 2026).

**There is no application code here yet.** This is the "measure twice" pass: the answers
turned into a data model, a job lifecycle, and a set of screens concrete enough to build
from without guessing.

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
