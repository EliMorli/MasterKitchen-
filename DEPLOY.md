# Deploying

Supabase is already live. Vercel needs one import — about two minutes, and after
that every push deploys itself.

## Supabase — done

| | |
| --- | --- |
| Project | `masterkitchen` |
| Ref | `oyyasackypbohstxqmnn` |
| Region | `us-east-1` |
| URL | `https://oyyasackypbohstxqmnn.supabase.co` |

Schema, row level security, storage buckets, seed templates and the four portal
functions are all applied — see [`supabase/README.md`](supabase/README.md).

Two accounts exist already, created with confirmed emails so they work
immediately:

| Email | Role |
| --- | --- |
| `elimadmorli@gmail.com` | Owner |
| `office@masterkitchen.app` | Data logger |

Both have the temporary password **`MasterKitchen2026!`**. Change them on first
sign-in.

## Vercel — import the repo

1. [vercel.com/new](https://vercel.com/new) → import **`elimorli/masterkitchen-`**
   into the **eli's projects** team.
2. Branch: `claude/master-kitchen-discovery-gugsw7` (or merge to `main` first and
   deploy that).
3. Framework preset: **Next.js**. Everything else auto-detects — no build command
   or output directory to set.
4. Add two environment variables, for Production, Preview and Development:

```
NEXT_PUBLIC_SUPABASE_URL=https://oyyasackypbohstxqmnn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWFzYWNreXBib2hzdHhxbW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDYzODYsImV4cCI6MjEwMTAyMjM4Nn0.9-KbYn8nLsORr0n_8vXlP-7rXlWLST8oM09HCecMsMg
```

5. Deploy.

The anon key is safe in the browser — that is what it is for. Every table is
behind row level security, and the only thing an anonymous caller can reach is
the four token-scoped portal functions. There is no service-role key in this
project, deliberately.

## After the first deploy

**Turn off email confirmation**, or new accounts can't sign in. Authentication →
Providers → Email → uncheck *Confirm email*. The built-in mailer is also rate
limited to a couple of messages an hour, so leaving confirmation on means new
users get stuck. With four users total and accounts created by an owner, there is
nothing to gain by keeping it on.

**Check the markup default.** Settings shows a worked example: at 50% markup a
$10,000 cost becomes $15,000, which is a 33.3% gross margin. If "50%" meant gross
margin, set the default to 100 instead. See
[`docs/04`](docs/04-pricing-and-bidding.md).

## Switching WhatsApp to automatic sending

The app ships in manual mode: it writes the exact message and you send it with one
tap. Nothing else changes when you switch — same drafts, same Outbox review, same
audit trail. Add these when the Official Business Account is approved:

```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v21.0
```

Group messaging additionally requires the number to be on the Cloud API rather
than the WhatsApp Business app. [`docs/07`](docs/07-communications.md) has the
full picture, including why the existing groups can't be adopted.
