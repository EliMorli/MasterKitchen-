# 09 — Open questions

What discovery did not settle. Ordered by how much each one blocks. Items 2 and 3 have since been
answered and are kept, marked, so they don't get re-raised.

---

## Blocking

### 0. ★ WhatsApp number strategy — now the critical path

The decision to go straight to the API ([07](07-communications.md)) makes this the longest lead
item in the project. Nothing about it is a software question, and it can start today.

**Need:**

- Is the number currently on personal WhatsApp, the WhatsApp Business **app**, or already the
  Cloud API? The Groups API **does not work on WhatsApp Business app numbers**, so this may force
  a move.
- Move the existing number to the Cloud API, or stand up a new dedicated one? Moving keeps the
  number reps already know but takes the phone app away from the owners. A new number is clean but
  is a new number to everybody.
- Is there a verified Meta Business account? An **Official Business Account** is required for
  groups, and approval time is not guaranteed.

**Blocks:** all group automation. Everything else in the build proceeds without it, but nothing
substitutes for starting it early.

### 1. Q24 was unintelligible — does crew pay change by distance, difficulty, or crew?

The recorded answer to *"Does that number change by job — distance, difficulty, which crew?"* was
two untranscribable words.

Q23 partly covers it — cost varies by materials and destination, and *"once we get the price from
the vendor, we know how much it's going to cost us"* — which suggests the crew's own quote already
absorbs distance and difficulty, and there's no separate adjustment on Master Kitchen's side.

**Confirm:** is the sub's number simply whatever they bid for that job, with no adjustments
applied afterward? If yes, the payout model in [06](06-invoicing-and-payouts.md) is already
correct and this closes.

### 2. Does "50%" mean markup on cost, or gross margin?

**Mostly resolved.** Margin is a percentage, the same most of the time, around 50%, and must
always stay adjustable and editable.

What's left is one sentence of confirmation: 50% **markup on cost** (`cost × 1.5`) or 50% **gross
margin** (`cost ÷ 0.5`)? On a $35,200 cost that's $52,800 vs $70,400 — see the table in
[04](04-pricing-and-bidding.md).

The quote screen shows both numbers live, so this can't cause a mistake in practice. It only
determines which reading gets seeded as the default. **Not blocking** — confirm before launch.

### 3. ~~What protects the design?~~ — Closed

**Answered:** nothing needs to. The job is already sold by the sales rep before it reaches Master
Kitchen, and the GC comes to them specifically to sub the work. The relationship is the
protection — *"they're not going to leave us, because that's the whole relationship."*

So the milestone-1 invoice at designer dispatch stands as specified, and no deposit-retention or
design-release mechanism is needed. Recorded here so it doesn't get re-raised.

### 4. Milestone percentages

[06](06-invoicing-and-payouts.md) proposes milestone *structures* for both job types. The
*amounts* were never specified — only that the flat price gets broken up (Q25, Q46).

**Need:** what percentage of the flat price does each milestone carry, for each job type? Same
question for the sub payout side.

---

## Non-blocking

### 5. The Google Sheet's columns

Q16 declined to share it. The described behavior is understood — design uploaded, vendors and
crews price it, shared visibility — and [04](04-pricing-and-bidding.md) is specified from that
description.

Still worth a screenshot with the names blanked out, purely to confirm no column is being missed.
Low risk if it never arrives.

### 6. "All in-house" vs "they are subs"

Q38 says everything is in-house and nothing is subbed. Q22 says the crews are subs.

[01](01-how-the-business-works.md) reads this as: no per-trade subcontracting — one full-service
sub crew does the job A-to-Z, so from the GC's side it's all Master Kitchen. **Confirm that
reading.** If some trades really do go to separate specialist contractors, the model needs
multiple partners per project with per-trade scopes.

### 7. Sunday work

Saturdays are working days (Q36). Sunday was never asked. Defaulting to Mon–Sat with Sunday as a
setting.

### 8. Reschedule frequency

Q33: *"I don't know."* Not answerable today, which is why [05](05-scheduling.md) specifies logging
old date, new date, and reason on every move. Three months of that answers it with data.

### 9. Payment terms in practice

Q46 says terms depend on the job. Not captured: what the terms usually *are* (net 15? net 30?),
and whether GCs actually pay on time. The AR aging view will surface the second one on its own.

### 10. Designer arrangement

Designers are dispatched fast and often, but whether they're employees, subs, or one regular
partner was never asked. Affects whether design cost is a payout line or overhead.

### 11. Invoice delivery channel

Q45 describes a standard business invoice. Not specified: email, WhatsApp, or portal — and to
whom, the rep or the GC's accounts payable. Given [01](01-how-the-business-works.md)'s finding
that the rep is the only contact, an AP contact per client company may need to be added.

### 12. Moved — see [#0](#0--whatsapp-number-strategy--now-the-critical-path)

Promoted to blocking now that the API is the chosen path.

### 13. Company name, branding, invoice identity

Nothing was captured about legal entity name, logo, invoice branding, addresses, or bank details.
Needed before the first invoice PDF renders.

### 14. Direct Cloud API or a BSP?

[07](07-communications.md) requires **inbound group webhooks**, which is the feature to evaluate
against — not outbound convenience. Group support is new, so it must be confirmed explicitly
rather than assumed from a vendor's feature list.

Direct Cloud API is cheaper and gives full control; a BSP handles onboarding, template
submission, and number migration. Given there is no in-house developer today, a BSP may be worth
the margin — but only one that exposes group webhooks.

### 15. Languages used in the groups, and voice notes

The [message agent](11-message-agent.md) reads what reps and crews write.

**Need to know:** what languages actually appear in these threads, and how much of the
communication is voice notes rather than text? Contractor groups are typically heavy on both, and
voice transcription is a real cost and quality factor. This changes extraction accuracy more than
any other single input.

### 16. Who belongs in each group?

Groups cap at **8 participants**. Need the normal roster: which owners, how many crew members,
whether the rep ever adds colleagues. Also worth knowing whether a single job ever runs two crews
simultaneously — if so, that needs a second crew group, since the cap is hard and removed
participants **cannot rejoin**.

---

## Answers that closed things off — recorded so they don't get relitigated

These are all cases where the questionnaire offered structure and the answer declined it. Each one
is a feature *not* to build:

| Question | Answer | Consequence |
| --- | --- | --- |
| Long list of price drivers (stairs, access, waterfall edges, sink cutouts…) | Only distance and finish material | No parametric pricing calculator |
| What blocks scheduling (cabinets, stone, client readiness…) | Only failed inspections | No material-readiness gating |
| What's required on an invoice (PO, photos, signed sheets) | Standard invoice only | No completion-paperwork workflow |
| Crew expenses (gas, tools, dump runs) | Subs cover their own | No expense tracking |
| Rework cost | *"We don't need to track it"* | No rework cost attribution |
| Minimum job size | None | No floor validation |
| Unpaid extra work per year | None | Change-order flow preserves, doesn't rescue |
| Crew headcount | *"It doesn't really matter"* | No roster or capacity engine |
