# 08 — Crew job links

## The idea, as described

Q64, near-verbatim:

> Eventually we'll send them a link that they can use per job. In my head, in the WhatsApp group
> there would be a pinned link that they go to, and they just upload pictures of the job. That
> link is specific to each job individually. The link itself will already just open and upload
> pictures or an update, and then it automatically sends it to the right project within the
> system.

This is a well-formed idea and worth building close to as described. It threads the needle the
whole system has to thread: the crew never leaves WhatsApp, never makes an account, never learns
anything — but their photos land in the right place automatically.

## How it works

```
   Project created
        │
        ▼
   Job link generated:  https://app.masterkitchen.com/j/{token}
        │
        ▼
   Pinned in the crew's WhatsApp group
        │
        ▼
   Crew taps it on site  ──►  camera / gallery opens  ──►  uploads
        │
        ▼
   Photos land on the project timeline, tagged, timestamped
```

The token carries the project identity, so nothing has to be selected, typed, or matched later.
That is the entire point — the "automatically sends it to the right project" part is what makes it
worth having.

Once Phase 2 of [07 — Communications](07-communications.md) is live, the pinning can be done by
the system too: the Groups API allows a business to pin up to 3 messages in groups it
administers, which is exactly the described workflow with the last manual step removed.

## The page

Deliberately minimal. Anything more gets ignored on a job site.

- Address at the top, so the crew knows they're in the right job
- **Big upload button** — camera or gallery, multiple files
- Optional note field
- Optional tag: `progress` / `problem` / `extra work` / `complete`
- Submit

No login. No app. No account. It should work one-handed on a dusty phone in bad light.

## The "extra work" path

The `extra work` tag matters more than it looks. Today that flow is (Q51): crew notices something,
messages the owner on WhatsApp, owner reads it, owner relays to the rep, rep approves by text.

With the tag, a flagged upload creates a **pending change order** on the project with the photos
already attached — so the owner's job becomes pricing and relaying rather than transcribing.
Photos of the actual condition attached to the change order also make the rep's approval easier
to get and easier to defend later.

## Security

The token is the credential, so it has to behave like one:

- Cryptographically random, at least 128 bits, not sequential or guessable
- Scoped to exactly one project — a leaked link exposes one job's address and photos, nothing more
- Revocable per link
- Optional expiry, defaulting to a while after job completion
- Write-mostly: the page shows the address and the crew's own uploads, not pricing, not margin,
  not the client's identity, not other jobs
- Rate-limited and size-capped per token to stop a leaked link becoming free file hosting

Multiple links per project are supported, which is what lets one be issued per crew and revoked
independently.

## Owner side

Uploads appear on the project timeline in order, and land in a **needs review** queue so nothing
sits unseen. From there the owner can:

- Forward photos to the rep's group (drafted into the Outbox, sent on approval)
- Convert an `extra work` upload into a priced change order
- Mark a task complete off the back of a `complete` upload
- Attach a photo to a milestone as informal proof of work

Note that photos are **not** required on invoices — Q45 was explicit that a standard invoice is
all a business client needs. Photos are for the owners' own record and for updating the rep, not
for billing paperwork.

## Why it earns its place

- Kills the worst part of the current loop: photos buried in a chat, findable only by scrolling
  (Q57)
- Requires nothing from the crew beyond tapping a pinned link
- Timestamps and locates evidence automatically
- Turns site-found extra work into a tracked record instead of a message that might get missed
- Gives the owners something to send the rep proactively, which is what Q65 was reaching for

## Phasing

Not required for the first release — the owner said *"eventually."* But the token infrastructure
is the same as the bid portal's ([04](04-pricing-and-bidding.md)), so building the portal makes
this nearly free afterward. Suggested for Phase 2, when it can ship alongside the messaging work
it complements.
