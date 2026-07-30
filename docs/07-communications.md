# 07 — Communications (WhatsApp)

The other half of Q67. Read this before committing to a plan, because the answer here changed
during discovery research.

## What was asked for

Q65, near-verbatim:

> If we scheduled the guys for 8:00 and we approved it very early in the morning, we'll have all
> these things ready to shoot out messages. We go over it and then we say "okay, yeah" — the guys
> will be there at 8:00 a.m. at this job — and then we just send that out automatically to the
> sales rep that we're talking to for that specific job.

And Q58 on what breaks today:

> Sometimes approval of schedule... we want to automate that process. Once we get approved and
> the schedule goes through on our end, it will update the sales rep with something like "the
> guys will be there tomorrow at 8:00," because communication is key.

Note the shape carefully: it is **not** "the system sends messages on its own." It is *messages
prepared in advance, reviewed in a batch, then released*. The human stays in the loop by design.
That is the right instinct and the spec keeps it.

## The constraint

Q68: *"getting off of WhatsApp is very hard... the sales reps and the technicians won't get off
WhatsApp, and you can't change that."* A previous attempt already failed on this. WhatsApp is
immovable. Everything below works around it rather than against it.

Current state: ~40 live groups, two per project — one with the sales rep, one with the technicians
(Q55) — with the owners relaying between them all day.

## What's actually possible — the finding

The initial assumption for a spec like this would be that WhatsApp's official API can't post to
groups at all, which would kill the group-automation idea outright. **That is no longer true.**

Meta has opened a [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups)
on the WhatsApp Business Platform. The [Messages API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)
now accepts `recipient_type: "group"` alongside `individual`, supporting text, media, and
template messages.

The conditions attached matter a great deal here:

| Condition | Consequence for Master Kitchen |
| --- | --- |
| Requires an **Official Business Account (OBA)** | A verification hurdle to clear before any of this works |
| **Max 8 participants per group** | Fine — a rep group and a tech group are both small |
| Groups are **created by the business** via the API; participants join by invite link | **The existing ~40 groups cannot be adopted.** New projects get new groups |
| Only **one Cloud API business per group** | Fine |
| **Not available on WhatsApp Business App numbers** | The number must be on the Cloud API, not the phone app |
| Up to **10,000 groups per number** | At ~20 jobs/month × 2 groups, ~20 years of headroom |
| Business can **pin messages** (max 3, admins only) | Directly enables the pinned upload link from Q64 |
| Interactive messages, disappearing messages, view-once unsupported | Irrelevant here |

Two of these are decisive. The **OBA requirement** is a real gate with an approval process and no
guaranteed timeline. And **existing groups can't be brought in** — automation only applies to
groups the system creates from here on.

Which means: automation is achievable, but it cannot be the first thing that ships, and it cannot
be the only plan.

## The three transport options

**A. Compose-and-copy (no API, works today)**
The system writes the exact message and puts it one tap away: a copy button, or a
`https://wa.me/<phone>?text=<message>` deep link that opens WhatsApp with the text pre-filled.
The owner pastes into whichever group they want.
*Works with all 40 existing groups. No approval, no platform risk, no cost. Costs one human tap.*

**B. Cloud API Groups (the real automation)**
The system creates each project's groups, invites the rep and the techs by link, sends
automatically, pins the upload link, and receives replies as webhooks — meaning inbound messages
can land on the project timeline instead of being scrolled for.
*Requires OBA. New groups only. Per-message cost.*

**C. Unofficial libraries** (Baileys, whatsapp-web.js, and similar)
These drive a linked device and can post into any existing group, including the current 40.
They also violate WhatsApp's terms and put the business's primary phone number at risk of a ban.
For a company whose entire operation runs on that number, that is not a survivable risk.
**Not recommended.**

## Recommended path

Build the message engine once, behind a transport interface. Ship A immediately, add B when the
OBA lands.

```
   Trigger (schedule confirmed, inspection passed, milestone reached)
                        │
                        ▼
              Template + project data
                        │
                        ▼
                  DRAFT MESSAGE  ────►  the Outbox
                        │
                        ▼
                 Owner reviews, approves
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
      Phase 1: copy /        Phase 2: Cloud API
      wa.me deep link        sends to the group
              └─────────┬─────────┘
                        ▼
                   Logged on the project
```

Same drafting logic, same review step, same audit trail. Only the last hop changes — so Phase 2
is a transport swap, not a rewrite. Existing projects can stay on manual send forever while new
ones use the API, which makes the migration a non-event.

## The Outbox

The screen that carries the whole feature, and the literal implementation of *"we'll have all
these things ready to shoot out messages... we go over it and then we say okay, yeah."*

Every morning it holds the day's drafts:

| To | Project | Message | |
| --- | --- | --- | --- |
| Dave (Ridgeline GC) | 412 Maple St | "Crew will be at 412 Maple St tomorrow at 8:00 AM for cabinet install." | Send / Edit / Skip |
| Crew A | 412 Maple St | "412 Maple St tomorrow 8:00 AM — cabinet install. Details: [link]" | Send / Edit / Skip |
| Mike (Summit Homes) | 88 Oak Ave | "Electrical inspection passed at 88 Oak Ave. Cabinets going in Thursday." | Send / Edit / Skip |

Every message is editable before it goes. **Approve all** exists for the common morning where
everything is right. Nothing sends without a human, in either phase.

## Triggers and templates

| Trigger | To | Template |
| --- | --- | --- |
| Task scheduled/confirmed for tomorrow | Rep | "Crew will be at {address} tomorrow at {time} for {task}." |
| Task scheduled | Crew | "{address} on {date} at {time} — {task}. Job page: {link}" |
| Task rescheduled | Rep + crew | "Update on {address}: {task} moved from {old} to {new}." |
| Inspection passed | Rep | "{type} inspection passed at {address}. Next: {next_task} on {date}." |
| Inspection failed | Rep | "{type} inspection at {address} did not pass. {notes} Rescheduling." |
| Design complete | Rep | "Design for {address} is ready: {link}" |
| Quote sent | Rep | "Quote for {address}: {price}, all in. Let us know to proceed." |
| Milestone reached | Rep | "{milestone} complete at {address}. Invoice {number} sent." |
| Change order pending | Rep | "Extra work found at {address}: {description}. Additional {amount}. Approve?" |
| Job complete | Rep | "{address} is complete. Final invoice {number} sent." |

Templates are editable in-app. Tone should match how they already write — short, direct, no
corporate voice. A rep who notices the messages changed character will start ignoring them.

## Inbound

Phase 1: no inbound capture. The gap is filled by the crew upload link
([08](08-crew-job-links.md)), which routes photos and notes to the right project without anyone
leaving WhatsApp — and which addresses Q57's *"scrolling back for the design and prices"* from
the other direction, since anything that lands in the system stops needing to be found in a chat.

Phase 2: webhooks put group replies on the project timeline automatically.

## What this does not do

It does not get anyone off WhatsApp, and it should not try. Reps and techs keep using WhatsApp
exactly as they do now. The change is entirely on the owners' side: instead of composing forty
messages a day from memory, they review a prepared list and release it. That was the ask.
