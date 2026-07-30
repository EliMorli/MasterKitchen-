# 05 — Scheduling

## What the schedule actually is

Short-horizon and fast. Q30: sometimes one day out, sometimes a week. A rep sells a job and asks
for a designer *tomorrow*. A sold remodel starts demo ASAP *"because it's all about right away."*

This rules out anything resembling a Gantt chart or a critical-path planner. What's needed is a
**week view you can drag things around in**, with today prominent.

## Duration reality

From Q32 and Q42, which are the most useful numbers in the whole discovery:

| Job type | Fastest observed | Longest observed |
| --- | --- | --- |
| Full remodel (demo → countertops) | **5 days** | **~2 weeks** |
| Install only | Can be **one day** — cabinets AM, countertops PM | — |

The single-day install is possible because the countertops are prefabricated. There is no
template-then-fabricate-then-install wait to model. This removes what is normally the hardest
constraint in kitchen scheduling, and the system should not carry machinery for it.

## Task types

| Task | Typical duration | Applies to |
| --- | --- | --- |
| `design_visit` | Half day | All jobs |
| `demo` | 1 day | Full remodel |
| `plumbing_rough` | 1 day | Full remodel |
| `electrical_rough` | 1 day | Full remodel |
| `inspection` | Slot | Full remodel |
| `cabinet_delivery` | Slot | All |
| `cabinet_install` | 1 day or AM slot | All |
| `countertop_install` | 1 day or PM slot | All |
| `punch_list` | Half day | As needed |

`countertop_template` exists in the schema for the case where a job uses fabricated rather than
prefabricated stone, but it is not part of the normal flow.

## Slots, not times

Scheduling granularity is **date + slot**, where slot is `am`, `pm`, or `full_day`. This comes
straight from how they already work — *"one in the morning and one in the afternoon"* (Q34) — and
it is what makes the same-day cabinets-then-countertops pattern expressible.

A specific clock time is stored separately and used only for messaging ("the guys will be there
at 8:00"), not for planning.

## Crew capacity

Q34: two jobs in a day is possible, but **one per day is the default**. So: warn on a second
assignment for the same crew and day, don't block it. Q21 makes clear there is no fixed crew
roster and no meaningful capacity ceiling — *"we'll always have someone to send to the job"* — so
no resource-leveling engine is warranted.

## Working days

Saturdays are working days (Q36). Sunday was not asked and is not assumed — see
[09](09-open-questions.md) #7. The calendar should treat Mon–Sat as normal and make the Sunday
policy a setting.

## What blocks a job

Q31 is emphatic that almost nothing does. Only two things:

1. **A failed inspection.** The only genuine external gate — and *"it hardly happens."*
2. **Internal reprioritization.** *"Maybe we'll push a different job off because a different job
   needs more attention."*

Notably absent, despite being offered in the question: cabinets not delivered, stone not
fabricated, client not ready. None were adopted. **Do not build a material-readiness gating
system.** A `blocked` status with a free-text reason covers the real cases.

## Inspections

Division of labor from Q40: **the GC pulls the permit; Master Kitchen schedules and attends the
inspection.**

Tracked per inspection: type (plumbing, electrical, other), scheduled date, result
(`pending` / `passed` / `failed`), notes, and a link to the re-inspection if it failed.

Q41 describes a three-step reflex when one passes:

1. Mark it passed in the system.
2. Schedule the next task.
3. Tell the sales rep.

Steps 2 and 3 should be prompted automatically. Marking an inspection passed opens the next task
for scheduling and drafts the notification message to the rep — see
[07](07-communications.md).

## Crew assignment

Q28: *"depends on the size of the job, and where it is."* Size and location. That's the rule, and
it's judgment, not an algorithm.

So: assignment is manual. What the system provides is the information behind the judgment — when
choosing a crew for a task, show each partner's service area, their current load that week, and
whether they bid on this job. No auto-assignment, no scoring.

## Reschedules

Q33: *"I don't know"* how often jobs move. So the frequency is unmeasured — which is itself worth
fixing. Every schedule change should record the old date, the new date, and a reason. After three
months this answers the question with data instead of a guess.

A reschedule must also draft an update message to the rep. Q58 names schedule communication as
the thing that gets lost today.

## Screens

**Week view (default landing screen)** — Mon–Sat columns, tasks as cards, colored by type,
showing project, address, crew, slot. Drag to move. Unscheduled tasks sit in a rail on the left
waiting to be placed.

**Today** — everything happening today, with each task's message status: has the rep been told?
Has the crew been told? This is the screen the morning runs on.

**Project timeline** — one job's tasks in sequence with milestones and inspections inline.
