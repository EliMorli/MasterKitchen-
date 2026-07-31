# 13 — Rebuild plan

The first build was too complicated. This is why, what to copy from John Mould, and
what v2 looks like.

---

## Why it feels complicated

I built a **workflow**. John Mould built a **list you can edit**. That's the whole
difference, and it shows up everywhere.

| | Master Kitchen v1 | John Mould |
| --- | --- | --- |
| A job lives in | 6 tab routes | 1 row + 1 modal |
| Jobs screen | 130 lines across 7 files | **66 lines, one file** |
| Shared components | 20 | **12** |
| To edit something | find the right tab, find the right card, press that card's Save | click the row, change anything, press Save once |
| Invoices | not editable at all | click → edit every field → save |
| Sending a WhatsApp | draft → Outbox → review → release | *(not applicable — but the principle holds)* |

Their Jobs page is a stat row, a table, and a modal. Click any row and **everything
about that job is in front of you and editable**. That is the entire pattern, repeated
per screen. It's why theirs feels simple and this one doesn't.

Three concrete mistakes in v1:

1. **Tabs split the job.** Design on Overview, prices on Bids, money on Money,
   schedule on Schedule. Nothing talks to each other because nothing is on the same
   screen. This is the big one.
2. **A Save button per card.** One screen had four. You never know what's saved.
3. **Read-only where it matters.** Invoices could be sent or marked paid but never
   *edited*. Same for quotes once sent, and tasks after scheduling.

---

## The rule for v2

> **One screen per thing. Click the row, edit everything, save once.**

Everything below follows from that. If a feature can't fit that shape, it needs a very
good reason to exist.

---

## Screens

Keeping the Today / Work / Directory grouping — that part works. Eight screens instead
of nine, but each one is fatter and simpler.

### Today
| Screen | What's on it |
| --- | --- |
| **Dashboard** | Today's jobs, money owed, what needs a nudge. One screen, no clicking through. |
| **Calendar** | Month view. Click a day to see or add work. *(you asked for this)* |

### Work
| Screen | What's on it |
| --- | --- |
| **Jobs** | The heart. Table of every job → click → **one modal with everything**: address, client, rep, design, prices, crew, dates, milestones, invoices, profit, photos, WhatsApp. |
| **Money** | Invoices, payments in, expenses out — all in one table, all editable. Profit per job. *(you asked for expenses and profit)* |
| **Documents** | Designs, permits, photos, contracts. Uploaded per job, searchable across all jobs. *(you asked for storage and search)* |

### Directory
| Screen | What's on it |
| --- | --- |
| **Clients** | GC companies and the reps inside them |
| **Vendors & crews** | Who prices work and who does it |
| **Settings** | Markup, terms, invoice numbering, users |

**Gone:** the separate Portal screen and the separate Outbox screen. Both become
buttons inside the job modal, where they belong.

---

## WhatsApp, made simple

v1 had a whole message system: templates, drafts, an Outbox, an approve-then-release
queue, a message log, group records. That was built for automation that needs an
Official Business Account you don't have yet.

**v2 is one button.**

On a job: **`WhatsApp`** → pick what you're saying from a short list → it opens WhatsApp
with the text already written → you hit send.

```
   [ WhatsApp ▾ ]
     Crew will be there tomorrow at 8:00
     Design is ready
     Quote: $31,500 all in
     Inspection passed
     Invoice sent
     — or just type your own —
```

No drafts. No queue. No approval step. No message table to maintain. You are already in
WhatsApp all day; the app's job is to save you typing, not to become a second inbox.

When the Official Business Account comes through, automatic sending drops in behind that
same button. Nothing else changes.

---

## Everything is editable

The rule: **if you can see it, you can click it and change it.** Specifically —

- **Invoices** — number, amount, description, dates, status. All of it. Including after
  sending, because real invoices get corrected.
- **The price** — before, during and after quoting.
- **Milestones** — name and amount, any time.
- **Dates and crews** — from the calendar or the job.
- **Expenses** — add, edit, delete.

---

## What I'd copy from John Mould, precisely

1. **Table + modal per screen.** Row click opens everything.
2. **One Save per modal.** Not per card.
3. **A small shared component set** — Table, Badge, StatCard, Modal, Topbar. Roughly a
   dozen, not twenty.
4. **Stat cards across the top** of each screen, so the numbers are where you already
   look.
5. **One nav definition** feeding sidebar and phone drawer *(already done)*.
6. **Client-side pages with plain state**, rather than a server action per form field.

## What I would *not* copy

- Their flat 13-item menu — you prefer the grouping, and it's better at nine.
- Map, Leads, Reports as separate screens — you didn't pick them, and at 20 jobs a month
  they'd be dead weight. Profit per job lives on the job and on Money instead.

---

## What survives the rebuild

Not everything should be thrown away:

| Keep | Why |
| --- | --- |
| **The discovery answers** (`docs/00`) | The owners' own words. Cannot be recreated. |
| The business analysis (`docs/01`–`docs/11`) | Still accurate about how the business runs |
| **The Supabase project** | Same database, simplified schema — no need to re-provision |
| **The Vercel project** | Same URL, same env vars |
| Auth, RLS, the owner/logger split | Works, and was verified |
| The tokenized vendor and crew links | Vendors used it with no login — that part was right |
| The end-to-end browser test | Caught two real bugs; worth keeping the habit |

| Rebuild | Why |
| --- | --- |
| **Every screen** | Wrong shape — tabs and per-card forms |
| The message/Outbox system | Replaced by one button |
| The suggestion engine | Fold the useful checks into the Dashboard |
| Tables for messages, groups, claims, suggestions | Drop them; add `expense` and `document` |

---

## Schema changes

**Drop:** `message`, `message_template`, `whatsapp_group`, `extracted_claim`,
`suggestion` — five tables that existed only for the Outbox and the agent.

**Add:**
- `expense` — what we pay out on a job that isn't the crew *(you asked)*
- `document` — files per job, searchable *(you asked)*

**Profit per job** then falls out of what's already there: quote price, minus crew
payouts, minus expenses.

Net: 29 tables → about 26, and the ones that remain are the ones a screen actually uses.

---

## Order of work

1. Schema trim and the two new tables
2. Shared component set — Table, Modal, Badge, StatCard, Topbar
3. **Jobs** — table + the one big modal. This is most of the app.
4. **Money** — invoices, payments, expenses, profit
5. **Calendar** — month view
6. **Documents** — upload, list, search
7. Dashboard, Clients, Vendors, Settings
8. Browser test over the whole thing again

Jobs first, and worth getting right before anything else is built: if that modal is
good, the app is good.
