# Licensing Mertis — in plain English

Mertis is **source-available**, not open source. The code is published to
recipients, you can read it, fork it, patch it and run it — but production use
outside the Additional Use Grant needs a paid licence.

The legal text is [`LICENSE`](LICENSE) (Business Source License 1.1). This page
explains it; where the two disagree, `LICENSE` wins.

This page describes how **this version** behaves. It is documentation, not a
warranty or a separate contract, and later versions may behave differently. The
limits that bind you are the ones in the `LICENSE` of the version you are
running.

> Copies of earlier versions keep the terms they were distributed with. The
> grant below applies to 2.2.0 onward.

---

## What the Community grant allows

You may run Mertis in production on **any number of Instances**, for **your own
internal operations**, using only the Community Capabilities, provided each
Instance stays within:

| | |
|---|---|
| User Accounts | 5 |
| Projects | 3 |
| Bugs | 250 |

All three limits apply together.

**What counts.** An *Instance* is one production deployment using one logical
application datastore — a SQL database or a CSV storage directory. Extra
processes, servers or containers sharing that datastore are still one Instance;
a replica or a disaster-recovery standby carrying no live workload is not a
second one. A *User Account* is every account record in the Instance, including
administrators and service accounts, used recently or not. A *Project* and a
*Bug* are every such record, whatever its status — closing a bug does not
uncount it. A record stops counting when it is deleted. The counts are totals
across the Instance, not per person, team or project.

**Community Capabilities** are core bug tracking, project management including
the Pulse boards (Strike, Pit, The Line, The Wait, My Pulse, the Friday brief),
basic GitHub integration, and data export — together with the account
administration, authentication, storage, backup and restoration needed to use
them. That list is fixed by the `LICENSE` of the version you run. It is not
changed by a pricing page or a feature flag.

**People acting for you.** Your employees and contractors may use an Instance on
your behalf, within the same account limits.

## What needs a commercial licence

- Production use beyond the numerical limits above.
- Production use of a **reserved capability**, even below those limits: AI
  insights, duplicate detection and other AI analysis; reporting beyond the
  included Pulse views and Friday brief; custom fields and workflows;
  third-party REST API integrations other than the included basic GitHub
  integration and data export; scheduled email reports; advanced GitHub
  integration; S3 attachment storage; SAML single sign-on; audit logging and
  audit-log export; advanced permissions; SLA management; private LLM
  integration; child-licence issuance; and the supplied white-label and
  custom-branding management features.
- Providing Mertis to third parties as a **hosted or managed service**, paid or
  free, or operating Instances for clients' own operations.

Production use outside the Additional Use Grant requires a commercial licence
covering that use. **Modifications do not enlarge the grant** — a modified build
is under the same production scope as the original, and changing or removing a
technical check does not widen what you are permitted to do. Rebranding your own
build is a separate matter from using the supplied branding-management features:
the first is allowed within the grant subject to the required notices and to
trademark law, the second is reserved.

See the tier table in [README.md](README.md#licensing) or contact
<support@turneratech.com>.

## What is non-production

Non-production use — development, testing, evaluation and CI — is permitted by
BSL at any size. Personal use that serves a live operational purpose is
production use and must satisfy the Additional Use Grant.

## Product behaviour, separate from the licence

These are properties of the supplied build, not licence conditions:

- Attachments are capped at 5 MB each on Community.
- Data export is not behind a licence feature gate in this version, so it works
  on Community as well as the paid tiers. An administrator can download the
  instance as JSON, or a single project's bugs as CSV, from Admin or from the
  project's bug list, on MySQL, PostgreSQL and CSV storage alike. Permission to
  export is not a warranty that an export, backup or restore will succeed or
  will capture everything.

## What happens when a licence lapses

When a commercial licence expires or its scope shrinks, you may keep, view,
edit, export and delete the records lawfully created while it was in effect —
including data held in reserved features — even if the Instance is now over the
numerical limits. You may create new Accounts, Projects or Bugs for your own
internal operations only where that record type's own total stays within the
Community limit after the creation; being over on one type does not block
creation of another. The same permission covers existing client data on a
formerly authorised hosted Instance, but it does not let you onboard new hosted
customers or use other reserved capabilities to produce new results.

In this version the software behaves the same way: existing projects, bugs,
attachments and users stay readable, editable and exportable, and what stops is
creating beyond the Community limits. Mertis does not delete data or make it
unreadable when a licence lapses. This is a permission, not a promise that any
particular build will keep running.

If the licence server is unreachable, Mertis keeps running on the licence it
already verified. Verification is offline by design.

## Why BSL and not MIT

Mertis was previously MIT-licensed. MIT permits anyone to delete the licence
enforcement and redistribute, which makes the paid tiers unenforceable and the
project unfundable. BSL 1.1 keeps the source readable and self-hosting free for
small teams, while making commercial use fund the work.

Each released version converts to **Apache 2.0** on the Change Date named in its
`LICENSE`, or on the fourth anniversary of that version's first public
distribution, whichever comes first. Nothing is locked up permanently — the
licence is a delay, not a cage.

Copies previously supplied under MIT remain usable under their MIT terms.

## Questions

| | |
|---|---|
| Licence keys and activation | <licensing@turneratech.com> |
| Sales and quotes | <support@turneratech.com> |
| Technical support | <support@turneratech.com> |
| Free Community key | [mertis.turneratech.com](https://mertis.turneratech.com/) |
