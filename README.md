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
| [07 — Communications](docs/07-communications.md) | **WhatsApp automation — read this one carefully** |
| [08 — Crew job links](docs/08-crew-job-links.md) | The per-job photo/update upload link |
| [09 — Open questions](docs/09-open-questions.md) | What still has to be answered before build |
| [10 — Build plan](docs/10-build-plan.md) | Phasing, MVP scope, stack recommendation |
| [db/schema.sql](db/schema.sql) | Proposed Postgres schema (not applied anywhere yet) |

## Three things to look at before anything gets built

1. **WhatsApp group automation is possible now, but with conditions.** Meta opened a Groups
   API, so the "message goes out automatically to the sales rep's group" idea is real — but it
   requires an Official Business Account, caps groups at 8 participants, and only works for
   groups the system creates. The existing 40 groups can't be adopted. See
   [07 — Communications](docs/07-communications.md) for the full picture and the phased path
   that ships value before any of that is approved.
2. **The design deposit is unprotected.** Design cost is absorbed into the flat price, but an
   invoice goes out the moment the designer is dispatched. Nothing in the current process
   defines what happens if the GC takes the design and doesn't proceed. See
   [09 — Open questions](docs/09-open-questions.md) #3.
3. **The margin rule was never stated.** Vendor cost plus "our margin" produces the flat price,
   but whether that margin is a percentage, a fixed amount, or judgment per job is the single
   biggest gap in the pricing spec. See [04](docs/04-pricing-and-bidding.md).

## Status

Discovery synthesized. No stack chosen, no code written, no infrastructure provisioned.
[Doc 10](docs/10-build-plan.md) proposes the first slice.
