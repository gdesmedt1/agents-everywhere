# ForgeX launch replay (synthetic workplace stream)

Shareable demo dataset for Assumption Alarm content agents.

It is **not** a Slack export. It is a fictional replay of a real pattern: a vendor and a customer launching a private engineering community, talking past each other, locking decisions, then quietly invalidating the assumptions those decisions needed.

Use this to drive a stream of workplace messages in Ambiguous (chat, wiki, tasks). Humans get confused. The agent should keep decisions and assumptions aligned.

## What to build against

| File | Use |
| --- | --- |
| [world.json](world.json) | Fictional companies, products, glossary |
| [personas.json](personas.json) | Speakers for the stream |
| [stream.jsonl](stream.jsonl) | Ordered messages. Play in `seq` order |
| [decisions.json](decisions.json) | Gold labels: decisions, assumptions, later contradictions |
| [agent-prompt.md](agent-prompt.md) | Instructions for the content-generation agents |

## How to play the stream

1. Seed personas as Ambiguous users (or one agent per persona).
2. Emit `stream.jsonl` rows in order. Respect `delay_seconds` between events if you want a live demo. For a compressed demo, play `scene` groups `s1` then `s2` … `s7`.
3. After each `kind: decision` row, Assumption Alarm should extract 1-3 assumptions and wait for a human confirm.
4. Later `kind: evidence` rows should **not** mention the original decision. The alarm agent must connect them.
5. When `gold_decision_id` is set, the alarm should fire if the assumption is still active.

Do not dump the whole month in the live demo. Play **s1 + s3 + s6 + s7** if you only have two minutes.

## Redaction

Source was a real vendor-customer Slack channel. This dataset:

- Replaces every person, company, product, domain, and email
- Drops credentials, Zoom links, form embed IDs, member lists, personal family notes
- Compresses ~4 weeks of noise into ~90 turns that still read like Slack

If a line looks like a password, API token, or live customer URL, it does not belong here. File an issue and delete it.

## Demo promise

Judges should see people arguing about:

- Create password vs reset password
- Platform email vs marketing automation
- Forums vs blogs vs “perspectives”
- Native forms that cannot store submissions
- Launch day slipping because SSO was not ready
- Launch metrics that nobody can define

Then Assumption Alarm should resurface the **decision that no longer holds**, not a summary of the channel.
