# 04 — Pricing and the bid portal

## How a price is actually made

From Q3, verbatim: *"The cost is determined once we send over the design that we made to our
vendors. Then they give us a price... We put our margin on it and send it back to the GC sales
rep."*

```
        Design (fixed scope)
                │
                ▼
   ┌────────────────────────────┐
   │  Bid requests out          │   cabinet vendor → material cost
   │  to vendors and crews      │   full-service crew → A-to-Z labor cost
   └────────────┬───────────────┘
                ▼
        Selected bids = COST BASIS
                │
                +  distance / location adjustment
                +  finish material adjustment
                +  design cost
                │
                ▼
           TOTAL COST
                │
                +  MARGIN   ← the rule was never stated. See open question #2.
                │
                ▼
        ONE FLAT NUMBER  ──►  WhatsApp to the sales rep
```

Everything above the last line is internal and stays internal. The client sees one number
covering design, materials, labor, and delivery (Q11, Q12).

## Price drivers

Q9 gives two, and only two:

| Driver | Effect | Notes |
| --- | --- | --- |
| **Location / distance** | Up | Far jobs cost more; also affects what the crew charges (Q23) |
| **Finish material** | Up | Nicer finishes cost more from the vendor |

The questionnaire offered a long list of possible drivers — stairs, no elevator, tight access,
waterfall edges, sink cutouts, second floor. None were adopted. The answer was: *"once we look at
the design, most of the time we already know and give a flat rate."*

That is a real finding and the spec honors it. **Do not build a parametric pricing calculator.**
The design plus experience produces the number; the vendor bid produces the cost. The system's
job is to record and organize, not to compute a price. Two adjustment fields (distance, material)
plus a free-text note is the correct amount of structure.

If a rate card is ever wanted, it should be added after a year of stored quotes shows what the
implicit rules actually were.

## No minimum

Q14: no floor on job size, at least for now. `quote.price` needs no validation beyond > 0.

## Margin — the open question

"We put our margin on it" is the only description available. It is unresolved whether margin is:

- a fixed percentage of cost,
- a percentage that varies by job type or client,
- a fixed dollar amount, or
- pure judgment per job.

The schema supports all of them: `margin_type` (`percent` | `amount`), `margin_value`, and a
resolved `margin_amount` snapshot. A default can be set per client company and overridden per
quote. This must be answered before the quoting screen is built — see
[09](09-open-questions.md) #2.

## Change orders

The design is fixed; anything added later is a change order (Q15). The flow from Q51/Q52:

1. Crew finds extra work on site, reports it by WhatsApp.
2. Owner prices it and relays to the rep.
3. Rep approves — *"they approve it over text."*
4. Client price goes up; sub payout goes up.

Q54 reports zero unbilled extras today. The design goal is to keep that true at 3× volume, which
means the record must carry: description, cost delta, price delta, approval channel, approval
timestamp, and **evidence** — a pasted message or screenshot of the approving text. That last
field is cheap now and is the thing that settles a dispute later.

---

# The bid portal

This is the most concretely specified feature in the whole discovery. Q19, near-verbatim:

> Maybe a portal that will give the people "go into the portal, this is the password," and then
> just enter a price here. Same thing as the Google Sheet, but in the system. A portal for
> vendors. If I click that on the menu, I'll have a tab that says "portal," and that portal will
> take me to see on my end what they answered for each job we need a bid for. On their end, it's
> just one page, and that's where they could bid on it.

Two surfaces, exactly as described.

## Vendor side — one page, no account

**URL:** `/bid/{token}` where the token is unguessable and belongs to one `bid_invite`.
Optional shared PIN for the "this is the password" behavior the owner described.

The page shows:

- Job address (city and street; unit number optional — decide with the owners)
- Job type and the scope being priced ("cabinets only", "full job A-to-Z", "install only")
- The design files — viewable and downloadable, the whole reason the page exists
- Any notes from Master Kitchen
- Response deadline

The page collects:

- **Price** (required)
- **Lead time in days** (optional, useful for scheduling)
- **Notes / exclusions** (optional)
- **Submit**

After submit: a confirmation with the submitted number, editable until the deadline. No account,
no app, no login. A vendor can do this from a phone in thirty seconds, which is the only way it
gets used.

## Owner side — the Bid Board

A **Portal** item in the main nav, matching how the owner already pictures it.

A grid: projects awaiting pricing down the side, invited partners across the top.

| Project | Cabinet Co. | Stone Co. | Crew A | Crew B | Status |
| --- | --- | --- | --- | --- | --- |
| 412 Maple St — full remodel | $14,200 | $6,800 | $21,000 | *opened, no bid* | 3 of 4 in |
| 88 Oak Ave — install only | $9,100 | — | — | $7,400 | complete |

Each cell shows the amount, or that the invite was opened but not answered, or that it was never
opened. That distinction is worth building: it turns "chase everyone" into "chase the one person
who hasn't looked."

Actions from the board:

- **Select** a bid → becomes a `quote_cost_line` on that project's quote
- **Remind** → queues a WhatsApp/SMS nudge to the partner
- **Extend** the deadline
- **Invite** another partner to the same request

## Why this beats the Google Sheet

Q19's own framing is *"it's the same thing as a Google Sheet, but in the system."* The gains are
real but specific, and worth naming so the build stays honest about them:

- Vendors can't see each other's prices. In a shared sheet they can.
- A selected bid flows into the quote instead of being retyped.
- "Who hasn't answered" is a status, not a scan.
- Bids are attached to the project forever, so Q57's *"scrolling back for the design and prices"*
  stops happening.
- Nobody can drag a cell into the wrong row.
