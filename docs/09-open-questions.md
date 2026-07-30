# 09 — Open questions

What discovery did not settle. Ordered by how much each one blocks. The first four should be
answered before the corresponding screens get built; the rest can be resolved during the build.

---

## Blocking

### 1. Q24 was unintelligible — does crew pay change by distance, difficulty, or crew?

The recorded answer to *"Does that number change by job — distance, difficulty, which crew?"* was
two untranscribable words.

Q23 partly covers it — cost varies by materials and destination, and *"once we get the price from
the vendor, we know how much it's going to cost us"* — which suggests the crew's own quote already
absorbs distance and difficulty, and there's no separate adjustment on Master Kitchen's side.

**Confirm:** is the sub's number simply whatever they bid for that job, with no adjustments
applied afterward? If yes, the payout model in [06](06-invoicing-and-payouts.md) is already
correct and this closes.

### 2. ★ How is margin set?

The single largest gap. *"We put our margin on it"* (Q3) is the entire description.

**Need:** percentage or fixed amount? The same for every job, or does it vary by job type, by
client, by size? Who decides — is it a rule or a judgment call each time?

**Blocks:** the quoting screen. The schema supports every variant
([04](04-pricing-and-bidding.md)), but the default behavior and the UI can't be designed without
this.

### 3. ★ What protects the design?

Q13 says the design is included in the price. Q49 says an invoice goes out the moment the designer
is dispatched. Nothing says what happens in between if the GC takes the design and walks.

The design is the most valuable thing the business produces — it's what vendors price against and
what makes the quote possible — and it currently leaves the building before there's a signed
number.

**Need:** Is the design invoice actually a deposit? Is it kept if the job doesn't proceed? Has a
GC ever taken a design elsewhere? Should the design invoice be a distinct milestone with its own
terms?

This is a business-process question more than a software one, but the answer determines whether
milestone 1 is a deposit, a fee, or a formality.

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

### 12. WhatsApp Business account status

[07](07-communications.md) depends on an Official Business Account for group automation.

**Need to know:** is the current number a personal WhatsApp, the WhatsApp Business app, or
already on the Cloud API? Is there a verified Meta Business account? This determines how far away
Phase 2 is — and since the Groups API is unavailable on WhatsApp Business App numbers, it may
require moving to a different number, which is a decision the owners should make early even though
the work comes later.

### 13. Company name, branding, invoice identity

Nothing was captured about legal entity name, logo, invoice branding, addresses, or bank details.
Needed before the first invoice PDF renders.

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
