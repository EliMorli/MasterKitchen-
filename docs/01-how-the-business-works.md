# 01 — How the business works

## The position in the market

Master Kitchen is an intermediary. It sits between two parties that never talk to each other
through it:

```
Homeowner  ──►  General Contractor  ──►  MASTER KITCHEN  ──►  Vendors & sub crews
                (the "client")            (the business)       (who do the work)
                     ▲                          │
                     └──────  sales rep  ◄───────┘
                          (the actual human contact)
```

Master Kitchen has no relationship with the homeowner and never contacts them. Every inbound and
outbound message on the client side goes through one person: the GC's **sales rep**.

This has a direct modeling consequence, stated plainly in Q37: *"When we're tracking clients
we're tracking companies, and in those companies there are sales reps."* The billable client is
the **company**; the person you actually deal with is a **contact** inside it. Both are needed —
invoices go to the company, WhatsApp messages go to the rep.

## Actors

| Actor | Who they are | System role |
| --- | --- | --- |
| **Owners (2)** | Run everything today by phone and WhatsApp | Full access. Primary users. |
| **Data loggers (2)** | Receptionists, joining later | Data entry, no pricing or payout visibility |
| **Client company (GC)** | The general contractor. The billable entity. | Record only — no login |
| **Sales rep** | The human at the GC who sends the job and approves things | Receives messages. No login. |
| **Designer** | Goes to the property, produces 3D design and layout | Assigned to a task. No login (phase 1) |
| **Vendor** | Cabinet/countertop supplier who prices off the design | Bid portal, one page, token link |
| **Sub crew** | Does the work. Sometimes A-to-Z including demo/plumbing/electrical | Bid portal + per-job upload link |
| **Homeowner** | The end customer | **Not in the system.** No contact, ever. |

## The two job types

Determined *after* the design, not at intake. The system must let a project exist with the type
still undecided.

**Install only** — cabinets and countertops. Master Kitchen is called in for the design and the
install.

**Full remodel** — everything: demo, plumbing, electrical, inspections, cabinets, countertops.
Roughly 50/50 split with install-only, and per Q6, genuinely unpredictable job to job.

## In-house vs. subbed — resolving an apparent contradiction

Q22 says the crews are subs. Q38 says *"it's all in-house, we do the demo, the electrical and
plumbing, and everything. We're not subbing anything out."*

These are reconciled by what "subbing out" means to Master Kitchen: they do not hand individual
trades to separate trade contractors. One full-service sub crew carries a job A-to-Z under
Master Kitchen's name. From the GC's perspective the work is all Master Kitchen's; from the books'
perspective the labor is a 1099 sub.

The model therefore treats a crew as **one partner engaged per job for a scope**, not as a
collection of per-trade vendors. Flagged for confirmation in [09](09-open-questions.md) #6.

## One-stop shop, one number

Everything is bundled. Materials, labor, design, delivery — all inside a single flat price
(Q11, Q12). There are no line items exposed to the client and no separate charge for the design
visit or the template (Q13). The GC receives one number for the whole kitchen.

Internally there are line items — vendor cabinet cost, crew labor cost, distance, finish upgrade —
but they exist only to build up to the flat number and to compute margin. They are never shown
outside the company.

## What a normal week looks like

- WhatsApp messages arrive from sales reps announcing sold jobs, at ~20/month and climbing.
- A designer is dispatched, often same or next day, because "it's all about right away" (Q30).
- The design goes out to vendors and crews for pricing, today via a shared Google Sheet.
- Prices come back; margin is added; a flat number goes back to the rep over WhatsApp.
- Once accepted, work is scheduled in 1-day to 1-week horizons and pushed hard — the fastest full
  remodel on record was five days end to end.
- Both owners spend the day relaying: rep → crew, crew → rep, all by phone and WhatsApp, across
  ~40 live groups (two per project: one with the rep, one with the technicians).

## The constraint that shapes the whole system

From Q68:

> Getting off of WhatsApp is very hard. We have to use the same flow but make it smart on our end,
> because the sales reps and the technicians won't get off WhatsApp, and you can't change that.

This is not a preference, it is a design constraint, and it has already defeated a previous
attempt. **No part of this system may require a sales rep or a technician to log in, install
anything, or learn a new tool.** External parties get one of three things and nothing more:

1. A WhatsApp message.
2. A tokenized single-page link (vendor bid, crew upload) that opens and works with no account.
3. A PDF invoice by email.

All the intelligence lives on the owners' side. That is the entire product thesis.

## Glossary

| Term | Meaning here |
| --- | --- |
| **Client** | The GC company, not the homeowner |
| **Rep** | The GC's sales rep — the single human contact per job |
| **Project / job** | One kitchen at one address |
| **Design** | The 3D design and layout; the fixed scope everything else is priced against |
| **Bid** | A price returned by a vendor or crew for a defined scope on a project |
| **Quote** | The single flat number sent to the GC |
| **Milestone** | A named point in the job that triggers an invoice out and a payout to the sub |
| **Change order** | Scope added after the design is fixed; requires rep approval, usually by text |
| **Partner** | Any vendor, crew, or designer Master Kitchen engages |
