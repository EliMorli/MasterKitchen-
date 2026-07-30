# 06 — Invoicing and payouts

One of the two things the owner asked to fix (Q67). Today there is no accounting software at
all — Q66: *"currently nothing."* Not even QuickBooks.

## The core idea: milestones move money both ways

Q25: *"we pay in milestones... we break up the invoices according to that."*

A milestone is one object with two financial effects:

```
                    ┌──────────────┐
   invoice OUT  ◄───┤  MILESTONE   ├───►  payout TO the sub
   (GC owes us)     │  reached     │      (we owe the crew)
                    └──────────────┘
```

Keeping these on one object is what stops them drifting apart, and it means a single "mark
complete" action produces both a draft invoice and a draft payout.

## Milestone templates

Q46: *"we build out the milestones; it depends what kind of job it is."* So templates by job
type, editable per project.

**Install only**

| # | Milestone | Trigger |
| --- | --- | --- |
| 1 | Design | Designer dispatched |
| 2 | Cabinet install complete | Task done |
| 3 | Countertop install complete / final | Task done |

**Full remodel**

| # | Milestone | Trigger |
| --- | --- | --- |
| 1 | Design | Designer dispatched |
| 2 | Demo complete | Task done |
| 3 | Rough-in complete + inspection passed | Inspection passed |
| 4 | Cabinets installed | Task done |
| 5 | Countertops installed | Task done |
| 6 | Final / punch complete | Task done |

The **amounts** for each milestone are not specified anywhere in the answers — only that the flat
price gets broken up. Percentages per milestone need to be set with the owners; see
[09](09-open-questions.md) #4. The schema supports percent or fixed amount per milestone, so the
structure can ship before the numbers are decided.

## The design invoice fires early

Q49: *"we'll send out an invoice the second the designer is there. We schedule the designer, and
sometimes we schedule the designer the same day, then it'll be sent out."*

So milestone 1 triggers on **dispatch**, not completion, and it goes out before the job type is
known and before there is a quote. It functions as a deposit while being described as included in
the price (Q13).

This is worth the owners' attention. The design is the most valuable thing Master Kitchen produces
— it is what the vendors price against and what makes the whole quote possible — and it is handed
over early in the relationship. Nothing in the current process says what happens if the GC takes
the design and doesn't proceed. Raised as [09](09-open-questions.md) #3.

## What goes on the invoice

Q45: *"just a standard invoice — the details, nothing else, because we're sending it to a
business."*

Explicitly **not** required, despite being offered in the question: PO numbers, photos, signed
completion sheets. This is a meaningful simplification — a lot of contractor billing systems are
built around exactly that paperwork, and none of it is needed here.

Standard fields only:

- Invoice number (sequential, e.g. `MK-2026-0142`)
- Bill-to: the **client company**, not the rep
- Job address as a reference line
- Milestone description
- Amount
- Issue date, due date
- Payment instructions

## Terms

Q46: terms depend on the job. So per-project terms with a per-client default, `net_days` on the
invoice, and a due date computed at issue.

## Receivables

Q48: *"unpaid invoices"* is how they track who owes them — which today means memory and a scroll.

The AR screen:

| | |
| --- | --- |
| **Total outstanding** | Sum of everything sent and unpaid |
| **Overdue** | Past due date, sorted oldest first |
| **Due this week** | Coming up |
| **By client** | Which GC is slowest — currently unknowable |

Aging buckets (0–30 / 31–60 / 61–90 / 90+) come free once due dates exist. Given that the
business currently has no system at all, this screen alone is likely to surface money.

## Payouts to subs

Mirrors the invoice side. Q39: subs are paid **by job**, released at milestones (Q25).

Cost basis comes from the accepted bid ([04](04-pricing-and-bidding.md)). Q23 explains why it
can't be a rate card: *"each job is different... the materials change... depends on the
destination."* The number is whatever that partner quoted for that job.

Not tracked, deliberately:

- **Crew expenses** — gas, tools, adhesive, dump runs. Q26: *"they pay for everything
  themselves... we don't calculate that."*
- **Rework cost** — Q27: *"we don't need to track it."*

## Automation

The ask was to automate invoicing. Concretely:

1. **Milestone reached → invoice drafts itself.** Marking the task complete produces a draft with
   the right amount, client, and description.
2. **Owner approves → invoice sends.** Email with PDF. One click, not a re-typed document.
3. **Milestone reached → payout drafts itself** against the accepted bid.
4. **Overdue invoice → reminder drafts itself.** Never auto-sent — chasing a GC for money is a
   relationship decision, and it should always pass through a human.
5. **Change order approved → amounts adjust** on both the client price and the sub payout.

The pattern throughout is **draft automatically, send deliberately**. That matches how the owner
described wanting communications to work in Q65 — everything prepared in advance, then *"we go
over it and say okay, yeah."*

## Not in scope for v1

- Payment processing (no card or ACH rails requested)
- Full double-entry accounting
- Tax handling
- QuickBooks sync — nothing to sync with today; revisit if they adopt it
