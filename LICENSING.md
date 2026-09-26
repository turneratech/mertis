# Licensing Mertis — in plain English

Mertis is **source-available**, not open source. The code is published, you can
read it, fork it, patch it and run it — but production use above the Community
limits needs a paid licence.

The legal text is [`LICENSE`](LICENSE) (Business Source License 1.1). This page
explains it; where the two disagree, `LICENSE` wins.

This page describes how **this version** behaves. It is documentation, not a
warranty or a separate contract, and later versions may behave differently. The
limits that bind you are the ones in the `LICENSE` of the version you are
running.

> **Note for reviewers:** the Additional Use Grant wording in `LICENSE` is
> pending legal review.

---

## What is free

**Community Edition** is free for production use, forever, per instance:

| | |
|---|---|
| Users | 5 |
| Projects | 3 |
| Bugs | 250 |
| Attachments | 5 MB each |
| Webhooks | 1 |

It includes core bug tracking, Pulse boards (Strike, Pit, The Line, The Wait,
My Pulse, the Friday brief), basic GitHub integration, and **data export**.

**Export.** This version ships a data export that is not behind a licence
feature, so it works on Community as well as the paid tiers. An administrator
can download the whole instance as JSON, or a single project's bugs as CSV, from
Admin or from the project's bug list. It runs the same way on MySQL, PostgreSQL
and CSV storage.

Non-production use — evaluation, development, testing, CI, personal projects —
is unrestricted at any size.

## What needs a paid licence

Running Mertis in production beyond the Community limits, or using paid-tier
features. See the tier table in [README.md](README.md#licensing) or contact
<sales@turneratech.com>.

## What you may not do

- Remove, disable or circumvent the licence check or feature gating.
- Distribute a build with those removed, disabled or circumvented.
- Offer Mertis to third parties as a hosted or managed service without a
  commercial agreement.

## What happens when a licence lapses

Mertis degrades to Community Edition. In this version, existing projects, bugs,
attachments and users stay readable, editable and exportable; what stops is
creating beyond the Community limits until the licence is renewed. The software
does not delete data or make it unreadable when a licence lapses.

If the licence server is unreachable, Mertis keeps running on the licence it
already verified. Verification is offline by design.

## Why BSL and not MIT

Mertis was previously MIT-licensed. MIT permits anyone to delete the licence
enforcement and redistribute, which makes the paid tiers unenforceable and the
project unfundable. BSL 1.1 keeps the source readable and self-hosting free for
small teams, while making commercial use fund the work.

Each released version converts to **Apache 2.0 four years after publication**.
Nothing is locked up permanently — the licence is a delay, not a cage.

Releases published while the project was MIT-licensed remain MIT.

## Questions

| | |
|---|---|
| Licence keys and activation | <licensing@turneratech.com> |
| Sales and quotes | <sales@turneratech.com> |
| Technical support | <support@turneratech.com> |
| Free Community key | [turneratech.com](https://turneratech.com/mantis/) |
