# 07 — WhatsApp integration architecture

Supersedes the phased "manual first" plan from the original draft. The decision is to go
straight to the API, so this document specifies the real integration.

Companion doc: [11 — The message agent](11-message-agent.md), which covers the AI layer reading
those threads.

## The one idea everything rests on

**The project is the thread.**

A project and its WhatsApp groups are the same object seen from two sides. The group is not a
place messages happen to live — it is the project's communication surface, and everything said in
it lands on the project record automatically.

That is what makes the rest possible: the inbox, the agent, the invoice nudges. None of it works
if the link between a group and a project is fuzzy.

## Linking: by ID, never by name

The concern about "a mess of each group" is the right one, and it's solved by not relying on
names at all.

When the system creates a group through the API, Meta returns a **group ID**. That ID is stored
on the project. Every inbound message carries the group ID, so routing a message to a project is
a primary-key lookup — not a name match, not a guess.

The group *name* is therefore purely cosmetic. Someone can rename the group, and nothing breaks.

This is why groups must be **created by the system, never by hand**. A hand-made group has no
recorded ID and is invisible to the app. Creating groups becomes an app action, not a WhatsApp
action.

## Naming convention

The API lets you set the group **name and description** at creation and edit them later, so the
convention is enforced by code and can't drift.

```
MK-0142 · 412 Maple St · Sales
MK-0142 · 412 Maple St · Crew
```

- **Project code first** — sorts chronologically in the WhatsApp list, and makes the group
  searchable by code
- **Address second** — how everyone actually refers to a job
- **Audience suffix** — instantly tells you which room you're in before you type

Keep the whole string under ~60 characters; truncate the address, never the code. The description
field carries the rest: client company, rep name, job type, and a link back to the project page.

Two groups per project, matching how they already work (Q55) — one with the sales rep, one with
the technicians. Keeping them separate isn't just habit: **the crew must never see the client
price**, and one merged group would leak margin.

## Group lifecycle

```
Project created (intake)
        │
        ├──►  create "· Sales" group
        │     set name + description
        │     send invite link to the rep's 1:1 WhatsApp
        │
   Quote won, crew assigned
        │
        ├──►  create "· Crew" group
        │     invite the assigned crew
        │     pin the job upload link (docs/08)
        │
   Job closed
        │
        └──►  archive: group stays, project marked closed,
              thread stays readable forever on the project page
```

Creating the crew group only after the job is won avoids littering WhatsApp with groups for jobs
that never sell.

## The migration is easier than it looks

Participants can't be added directly — they **join via an invite link**, by choice. Normally
that's painful friction.

Here it isn't, because **the current process already creates a new group per project.** Reps and
techs are used to being pulled into a new group whenever a job starts. The only change is that
the invite arrives as a link instead of an add. That's it. No behavior change to sell, which
matters given Q68's warning that a previous attempt died trying to change behavior.

Rollout: **new projects only.** The existing ~40 groups can't be adopted by the API — they were
created on consumer WhatsApp and there's no way to import them. They run out naturally as those
jobs finish. There is no migration day and no cutover.

## Constraints that shape the design

| Constraint | Consequence |
| --- | --- |
| Max **8 participants** per group | Fine — a rep group is 2-3 people, a crew group 3-4. But it's a hard ceiling: a big job with several crews needs a second group, not a bigger one. |
| Groups are **invite-link only** | Onboarding is a link, not an add. |
| **Removed participants cannot rejoin** the same group | Don't remove anyone casually. If a crew is swapped mid-job, create a new group rather than removing and re-adding. Worth enforcing in the UI. |
| Only **one API business per group** | No issue. |
| **Not available on WhatsApp Business App numbers** | The number must be on the Cloud API. See [09 #12](09-open-questions.md). |
| Requires an **Official Business Account** | The long pole. Start this application first. |
| **10,000 groups** per number | ~20 years of headroom at current volume. |
| Interactive/carousel messages unsupported | Irrelevant — messages here are text and photos. |

## Cost — smaller than it looks

This is the finding worth internalizing before anyone worries about per-message pricing.

Group messages are billed **per delivered message per participant**. A message to a 6-person group
is 6 billable messages. On its own that sounds bad.

But: **when any group member sends a message, a 24-hour customer service window opens for the
whole group, and free-form messages are free inside it.**

Master Kitchen's groups are conversations, not broadcasts. Someone — rep or crew — writes in a
live job's group most days. So the window is open most of the time, and most messages cost
nothing. Only messages sent into a group that has been silent for 24+ hours need a pre-approved
**template**, and those are billed per participant.

At ~20 jobs/month, that's a handful of template messages per job across a few participants. This
is a rounding error, not a budget line. **Do not design around message cost.**

What it does justify is a small UI affordance: show the window state on the project's
communication tab.

> 🟢 Free-form open · 19h left    or    🟡 Template required

so the owners know when a message costs something and when it doesn't.

## Templates to get approved

Templates need Meta pre-approval, so submit them early — they gate the out-of-window messages.
These map exactly to the triggers already specified:

| Template key | Use |
| --- | --- |
| `group_invite` | Sent 1:1 to a rep or crew with the join link |
| `task_scheduled_rep` | "Crew will be at {{address}} tomorrow at {{time}} for {{task}}." |
| `task_scheduled_crew` | "{{address}} on {{date}} at {{time}} — {{task}}." |
| `task_rescheduled` | "Update on {{address}}: {{task}} moved to {{new_date}}." |
| `inspection_passed` | "{{type}} inspection passed at {{address}}. Next: {{next_task}}." |
| `design_ready` | "Design for {{address}} is ready." |
| `quote_sent` | "Quote for {{address}}: {{price}}, all in." |
| `milestone_invoiced` | "{{milestone}} complete at {{address}}. Invoice {{number}} sent." |
| `change_order_request` | "Extra work at {{address}}: {{description}}. Additional {{amount}}. Approve?" |

All are **utility** templates, the cheapest category. Nothing here is marketing.

## The Communication tab — the omnichannel piece

Yes, build it. This is the right instinct and it's the centre of the product.

Per project, one screen:

```
┌─ 412 Maple St · MK-0142 ────────────────────────────────────┐
│  [ Sales · Dave R. ]  [ Crew · Crew A ]      🟢 open 19h     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dave R.        Can the guys start Thursday?         9:14   │
│                                                             │
│  You            Thursday works, 8am.                 9:31   │
│                                                             │
│  Crew A (Luis)  [photo] demo done                   14:02   │
│                 └─ saved to project · tagged progress       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Type a message…                              [Send]        │
└─────────────────────────────────────────────────────────────┘
```

What it does:

- **Both groups, one screen**, as tabs. Never merged — sending to the wrong room is how the crew
  sees the client price.
- **Senders identified.** Inbound group messages identify the individual sender, so you know
  whether the rep or a specific technician said something. This is what makes the agent in
  [doc 11](11-message-agent.md) possible.
- **Reply from the app** — goes out through the API into the real group. The rep sees it in
  WhatsApp exactly as before and has no idea the app exists.
- **Photos auto-file.** Every image lands as a project attachment, timestamped and searchable.
  This kills Q57 outright — no more scrolling back for the design and prices.
- **Window state** shown, per above.
- **Full history**, permanently, on the project. When a job comes up a year later the whole
  conversation is right there.

The owners can still answer from their phone in WhatsApp directly, and it all syncs. That matters:
nobody is forced into the app to answer a quick question at 7pm.

## On sent.dm

Worth flagging, since it was the reference: **sent.dm isn't the model for this.** It's an outbound
routing API — one endpoint that fans messages across SMS/WhatsApp/RCS with automatic channel
selection and fallback. Explicitly not a conversation platform: no shared inbox, no threads, no
agent collaboration.

It's a good product for *sending* — transactional notifications at volume. But it doesn't provide
the per-project thread, and the whole value here is inbound: capturing what the crew and the rep
say, and reconciling it against the job.

So: build the inbox, and connect to WhatsApp either **directly via Cloud API** or through a **BSP
that exposes inbound group webhooks**. That's the requirement to evaluate vendors against — not
outbound features. Confirm group support explicitly, since it's new and not every BSP has it.

## Build order

The Official Business Account application is the long pole and gates everything. **Start it
first**, this week, before any code.

While it's pending, everything else is buildable and testable:

1. **OBA application + number strategy** ← start now, unblocks the rest
2. Project spine, quoting, milestones, invoicing (unchanged, no dependency)
3. Communication tab UI, message store, template drafting — against a mock transport
4. Template submission to Meta for approval (also has lead time — submit early)
5. Cloud API wiring: group creation, invite links, send, inbound webhooks
6. [Message agent](11-message-agent.md) on top of the now-flowing message stream
7. Crew job links, auto-pinned in the crew group

Steps 2-4 don't wait for step 1. If the OBA is delayed, everything except 5 still ships, and the
Communication tab degrades gracefully to compose-and-copy against the existing groups.
