# 11 — The message agent

> "an AI agent that goes over it and has insights... on the project page, and we'll say 'hey, I
> realize on the WhatsApp group, you guys are saying that this needs to be done,' or that you guys
> passed this, the install is done, but I don't see an invoice being sent out."

This is the highest-value idea in the project, and it's worth being precise about why.

Master Kitchen's actual job is reconciliation. Two owners sit between reps and crews, all day,
holding in their heads what was said in forty groups versus what has actually been done, scheduled,
invoiced, and paid. Things fall through the cracks not because anyone is careless but because that
state lives in a chat log and a memory.

The agent does exactly that job: **compare what the thread says against what the system records,
and surface the gaps.** It is not a chatbot, and it should never talk to a customer.

## The loop

```
   inbound group message
           │
           ▼
   ┌───────────────┐
   │   EXTRACT     │   what is being claimed here?
   └───────┬───────┘   "demo is done" → status claim, task=demo, state=complete
           │
           ▼
   ┌───────────────┐
   │  RECONCILE    │   what does the system think?
   └───────┬───────┘   task 'demo' is still 'scheduled'
           │
           ▼
   ┌───────────────┐
   │   SUGGEST     │   proposed action + the message that triggered it
   └───────┬───────┘   "Mark demo complete → milestone 2 → draft invoice"
           │
           ▼
   human accepts or dismisses  ──►  action runs, outbound message drafts
```

Every suggestion carries the message that produced it, verbatim and linked. The owner sees the
evidence, not just the conclusion.

## What gets extracted

Grounded in what actually gets said in these groups:

| Claim | Example | Fields |
| --- | --- | --- |
| **Status** | "demo is done", "cabinets are in" | task type, claimed state |
| **Schedule** | "can they come Thursday instead", "we'll be there 8am" | date, time, task |
| **Inspection** | "inspection passed", "inspector failed the rough" | type, result |
| **Extra work** | "there's rot under the sink, another $900" | description, amount |
| **Approval** | "ok go ahead", "approved", "yes do it" | what's being approved |
| **Problem** | "cabinets came damaged", "no access today" | description, severity |
| **Money** | "when is the invoice coming", "we paid last week" | reference |
| **Question** | anything ending in a question mark, directed at you | who asked |

## Reconciliation rules

The rules are the product. Each pairs a signal with a system state and produces a specific action.

| Chat says | System state | Suggestion |
| --- | --- | --- |
| Crew: install is done | Task still `scheduled` | Mark done → fires milestone → **drafts invoice** |
| Milestone `reached` | No invoice exists after 24h | **Draft the invoice now** ← the exact case described |
| "inspection passed" | Inspection still `pending` | Mark passed, schedule next task, draft rep notification |
| "inspection failed" | Inspection `pending` | Mark failed, block downstream tasks, draft rep notification |
| Extra work with a price | No change order | **Create pending change order**, pre-filled, photos attached |
| Rep: "approved" | Change order `pending` | Mark approved, **save the message as evidence**, adjust price and payout |
| New date agreed in chat | Calendar unchanged | Update the task, log the reason, draft confirmations |
| Rep asked a question | No outbound reply in 4h | Nudge: unanswered question |
| Job `complete` | Final invoice unsent | Draft final invoice |
| Invoice overdue | No chase message sent | Draft a reminder — **never auto-send** |
| Crew posts photos | Uploads unreviewed | Offer to forward a selection to the rep |

The second row is the one that pays for the whole feature. "The install is done but no invoice
went out" is money sitting still, and it is invisible today.

## Where it shows up

**On the project page** — an "Attention" panel above the timeline:

```
⚠  Crew A said the cabinets are in (yesterday, 4:12pm)
   Task "cabinet install" is still scheduled. Milestone 4 hasn't fired.
   [ Mark complete & draft invoice ]  [ Dismiss ]

⚠  Dave asked "any update on the countertops?" 6 hours ago — no reply.
   [ Draft a reply ]  [ Dismiss ]
```

**Globally** — a "Needs attention" queue across all jobs, sorted by money at stake then age. This
is the screen that replaces the mental list the owners carry, and it belongs next to the Outbox.

**As a daily digest** — one morning summary per active job, which fits the rhythm described in
Q65: everything prepared, reviewed in a batch, released.

## Rules the agent must obey

**It proposes, humans dispose.** Nothing acts on its own. Not one invoice, not one status change,
not one message. Every suggestion is a button a person presses. This is not timidity — an agent
that silently marks a job complete and invoices a GC creates a problem no efficiency gain repays.

**Never sends outbound on its own.** The agent drafts into the existing Outbox, where messages
already wait for approval. Same review step, same audit trail.

**Always cites.** Every suggestion links the exact message, sender, and timestamp. An uncited
suggestion is unverifiable and will be ignored within a week.

**Silence beats noise.** A suggestion queue that's wrong a third of the time gets abandoned. Tune
for precision: when unsure, say nothing. A missed nudge costs a day; a wrong one costs trust in
the whole feature.

**Group content is untrusted input.** Anyone in a group can write anything, including text shaped
to look like an instruction. The agent reads messages as *data about a job*, never as commands.
Since every action is human-gated and scoped to one project's own records, the blast radius of a
bad extraction is a dismissed suggestion.

**No autonomous customer contact, ever.** The rep is a business relationship. The agent writes
drafts; a human sends them.

## Practical realities of these threads

Worth designing for from the start rather than discovering later:

- **Voice notes.** Contractors send them constantly. Transcription is required or the agent is
  blind to a large share of what's said. Budget for it.
- **Photos carrying the message.** A picture of a damaged cabinet with no text is a real report.
  Vision-based tagging is a phase-2 nicety; auto-filing the photo to the project is phase 1 and
  matters more.
- **Mixed languages and shorthand.** Crews and reps write in fragments, and possibly not always in
  English. Extraction has to tolerate that. Confirm the languages in play before tuning.
- **Ambiguous references.** "It's done" — what's done? Resolve against the project's currently
  open tasks; if more than one fits, ask rather than guess.
- **Old claims.** A message from last week saying "we'll finish tomorrow" is not a claim about
  today. Weight by recency and don't resurface stale signals.

## Data

Three additions to the schema, all present in [`db/schema.sql`](../db/schema.sql):

- **`message`** extended: `direction`, `from_phone`, resolved sender, `external_id`,
  `whatsapp_group_id`, media
- **`extracted_claim`** — what the agent read out of a message, with confidence
- **`suggestion`** — the reconciliation output: type, proposed action as JSON, status
  (`open` / `accepted` / `dismissed` / `expired`), and the message it came from

Keeping claims and suggestions separate means extraction can be re-run and improved without
losing the record of what was proposed and what the owners did with it. That accept/dismiss
history is also the only honest measure of whether the agent is actually any good — track it from
day one.

## Build it in this order

1. **Ingest and store** messages with sender identity. Nothing intelligent. Immediately useful on
   its own: full searchable history per project.
2. **Extraction**, logged but not surfaced. Run it silently for a week or two and read the output
   against reality. This is where precision gets tuned, at zero risk.
3. **Two rules only** — "claimed done but no invoice" and "unanswered question". Both are high
   confidence and obviously valuable. Ship those, watch the accept rate.
4. **Expand the rule set** as accept rates justify it.

Resist shipping all twelve rules at once. The failure mode of this feature is noise, and noise is
irreversible — once the owners learn to ignore the panel, they ignore it forever.
