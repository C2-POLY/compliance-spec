# Manifest specification, v0.2

> Status: draft. The format is versioned by `spec_version`; schemas are in [`schema/v0.2/`](../schema/v0.2/manifest.schema.json) and [`schema/v0.1/`](../schema/v0.1/manifest.schema.json).

This page describes v0.2. Every field marked **(v0.2)** is new in v0.2 and rejected in a v0.1 manifest; everything else is the same in both versions. A v0.1 manifest (`spec_version: "0.1"`) stays valid against the v0.1 schema, and a v0.2 compliance repo may hold both (see [compliance-repo.md](compliance-repo.md#versions)). In a v0.1 manifest read by a v0.2 compliance repo, a missing v0.2 field is an open item of the dossier, never an error. [What changed in v0.2](#what-v02-changed) lists the changes.

A **manifest** describes what one repo does with personal data. It lives at `.compliance/manifest.yaml` in the repo. An external tool without a repo (a hosted CRM, for example) gets a hand-written manifest in the compliance repo, under `declared/<tool>/manifest.yaml` (see [compliance-repo.md](compliance-repo.md)); it follows the same schema.

The manifest says what **is**, not what should be. It never claims compliance: a person reviews it and the compliance repo records that review.

Conventions used below:

- `id` values match `^[a-z0-9][a-z0-9-]*$` and are unique within their list.
- `data` is a list of `personal_data` ids of the same manifest. The reference must resolve.
- Dates and durations: durations are ISO 8601 (`P3Y`, `P30D`, `PT12H`).
- Countries are ISO 3166-1 alpha-2 codes (`FR`, `US`).
- Unknown keys are rejected. A missing answer is written `unknown` where the format allows it, never left out.

## Top level

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.2"` for this version (`"0.1"` for a v0.1 manifest). The validator picks the schema from it. |
| `service` | object | yes | What the repo is. See [service](#service). |
| `personal_data` | list | yes | The personal data the service handles. May be `[]`. |
| `storage` | list | yes | Where that data rests, and for how long. May be `[]`. |
| `processors` | list | yes | Processors contracted by the organisation. May be `[]`. |
| `outbound_flows` | list | yes | Data leaving the service towards a third party. May be `[]`. |
| `automated_decisions` | list | yes | Decisions about persons taken by the service. May be `[]`. |
| `ai_features` | list | yes | Features that use AI. May be `[]`. |
| `notices` | list | no | **(v0.2)** Where the persons are told about the processing. See [notices](#notices-v02). |
| `linked_files` | list of strings | no | Globs, relative to the repo root, of the files that make the manifest stale when they change. |

The six lists are required, even empty: `processors: []` is a statement ("none"), whereas a missing list is an unanswered question.

`linked_files` at the root is what the lag is computed from (`git log <anchor>..HEAD -- <linked files>`, see [compliance-repo.md](compliance-repo.md)). It should be the union of the files named by the items. It is optional only because a declared tool has no repo; a manifest in a code repo without it never gets a lag, only `unknown`.

## Provenance: `source`

Every item (the `service`, each entry of the six lists and each notice) carries a `source`, so that a reviewer can check where a statement comes from.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `kind` | `code` \| `spec` \| `declared` | yes | `code`: read from the code. `spec`: stated in a specification. `declared`: stated by a person or a document. |
| `ref` | string | yes | `code`: path (or comma-separated paths) in the repo. `spec`: URL of the issue or spec. `declared`: who or which file made the declaration. |

When a `declared` value contradicts the `code`, the code wins and the manifest is wrong: that mismatch is what provenance is meant to expose.

## Per-item `linked_files`

Every item except `service` may carry its own `linked_files` (same format as the root). It tells a reviewer which files an item depends on. The lag uses the root list only; per-item lists let a later version report which items are probably stale.

## Per-item `component`

When `service.components` is set, an item may name the component it belongs to with `component: <id>`. The id must exist in `service.components`.

## service

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Human name of the service. |
| `repo` | string `owner/name` | no | The repo. Absent for declared tools. |
| `description` | string | yes | What the service does, in one or two sentences. |
| `controller` | enum | yes | Who decides why and how the data is processed: `organisation`, `user-of-the-app` (a local app: the person using it), or `shared`. |
| `controller_rationale` | string | no | **(v0.2)** Why the organisation is not (or not alone) the controller. Expected when `controller`, or the `controller` of any component, is not `organisation`; missing, it is an open item of the dossier. |
| `privacy_by_design` | list of strings | no | **(v0.2)** Measures the organisation took in the design of the service (GDPR Art. 25): "notes never leave the device", "no account needed". |
| `components` | list | no | For a repo holding several deliverables (API and worker, Mac app and iOS app...). |
| `source` | source | yes | Provenance. |

`components[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | Referenced by the `component` field of items. |
| `kind` | string | yes | Free text, e.g. `web-api`, `background-worker`, `frontend`, `desktop-app`, `ios-app`. |
| `controller` | enum | no | **(v0.2)** Same values as `service.controller`. Overrides `service.controller` for the items of this component: an offline app of a website, controlled by its user. |

Component ids are unique within `components`.

When `controller` is `user-of-the-app`, the organisation is not the controller of what the user processes locally: legal bases are `not-applicable`, and recipients reached with the user's own accounts are `outbound_flows`, not `processors`.

## personal_data[]

One entry per set of data collected for the same purpose.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | Referenced by `data` lists. |
| `component` | id | no | Owning component. |
| `subjects` | list of strings | yes | Whose data: "restaurant guests", "staff". At least one. |
| `fields` | list | yes | The data items. At least one. |
| `purpose` | string | yes | Why the data is processed. |
| `legal_basis` | enum | no | GDPR Art. 6 basis: `consent`, `contract`, `legal-obligation`, `vital-interests`, `public-task`, `legitimate-interests`, or `not-applicable` (the organisation is not the controller). Optional because a code scan cannot know it; a person declares it, usually in the processing file. |
| `source`, `linked_files` | | | See above. |

`fields[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | What the field is: "guest email". |
| `category` | enum | yes | See the table below. |

| Category | Use for |
| --- | --- |
| `identity` | Name, login, account id, avatar, any identifier of a person |
| `contact` | Email, phone, postal address |
| `financial` | Card data, bank account, payment references, amounts |
| `location` | Address, GPS, IP-derived location |
| `usage` | Behaviour: pages viewed, booking history, timestamps, scores |
| `professional` | Employer, role, work items |
| `connection` | **(v0.2)** IP address, technical headers (user agent), device identifiers |
| `health` | Health data (also special category data, Art. 9) |
| `special` | Any other Art. 9 special category (religion, origin, orientation, biometrics...), or free text that may reveal one |
| `credential` | Passwords, hashes, tokens, keys |
| `unknown` | Content whose nature the service cannot know (user-supplied files, free text). Do not force a category. |

## storage[]

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | |
| `component` | id | no | |
| `kind` | enum | yes | `database`, `file`, `object-storage`, `cache`, `memory`, `keychain`, `browser`, `log`, `backup`, `other`. |
| `location` | string | yes | Where, including the region or country when known: "PostgreSQL, EU region (Frankfurt)". |
| `data` | list of ids | yes | `personal_data` ids stored there. |
| `retention` | object | yes | See below. |
| `source`, `linked_files` | | | |

`retention`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `duration` | string | yes | An ISO 8601 duration (`P3Y`, `P30D`, `PT12H`), or `none` (no limit, kept until the user removes it), `session` (until the session ends) or `unknown`. |
| `trigger` | string | no | The event that starts the clock or ends the retention, in words: "after the last booking of the guest", "sign-out". |

Security measures per storage are not part of the manifest: nothing in the code states them reliably. They are declared in the processing file of the compliance repo.

## processors[]

Processors **contracted by the organisation**, with a data processing agreement. A recipient reached with the user's own account is not a processor: use `outbound_flows`.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | |
| `component` | id | no | |
| `name` | string | yes | Provider name. |
| `service` | string | yes | What it does for us. |
| `country` | ISO 3166-1 alpha-2 | yes | Where the processing happens (or the provider's seat when unknown). |
| `dpa` | `yes` \| `no` \| `unknown` | yes | Whether a data processing agreement (Art. 28) is signed. Quote `"yes"` and `"no"` in YAML. `no` and `unknown` are open items of the processings that use the processor. |
| `dpa_ref` | string | no | **(v0.2)** Where the signed DPA is, or which standard terms of the provider apply: "PayGate data processing addendum, signed 2025-11-20". |
| `transfer_outside_eu` | boolean | yes | Whether data goes outside the EU/EEA. |
| `safeguard` | string | no | The transfer safeguard when `transfer_outside_eu` is true: "standard contractual clauses", "adequacy decision". |
| `data` | list of ids | no | `personal_data` ids sent to the processor. |
| `source`, `linked_files` | | | |

## outbound_flows[]

Any movement of personal data from the service to a third party, whether a processor or not.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | |
| `component` | id | no | |
| `to` | object | yes | `name` (string, required) and `country` (ISO 3166-1 alpha-2 or `unknown`, required). |
| `data` | list of ids | yes | `personal_data` ids sent. |
| `purpose` | string | yes | Why it is sent. |
| `account` | enum | yes | Whose account or contract is used: `organisation` (a contracted provider), `user` (the user's own account or tool), `none` (no account, e.g. a plain HTTP call). |
| `processor` | id | no | **(v0.2)** The id of a processor of the same manifest: the flow goes to that processor. The reference must resolve. |
| `safeguard` | string | no | **(v0.2)** The transfer safeguard of this flow, when it leaves the EU/EEA or goes to an unknown country. |
| `source`, `linked_files` | | | |

A flow with `processor` is the same recipient as that processor: the register lists it once, as the processor, with its contract. Its transfer uses the flow's own `safeguard`, else the processor's. A flow without `processor` whose `to.name` and `to.country` equal those of a processor of the same manifest is read the same way (the v0.1 rule).

## automated_decisions[]

Decisions about persons taken by the service (GDPR Art. 22). Content generated by AI is **not** a decision: use `ai_features`.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | |
| `component` | id | no | |
| `description` | string | yes | The decision and what it affects. |
| `legal_or_similar_effect` | boolean | yes | Whether it has legal effects or similarly significantly affects the person. |
| `human_review` | boolean | yes | Whether a human can review or override it before it takes effect. |
| `source`, `linked_files` | | | |

## ai_features[]

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | |
| `component` | id | no | |
| `description` | string | yes | What the feature does. |
| `generates_content` | boolean | yes | Whether it generates text, image, audio or video (AI Act Art. 50). |
| `interacts_with_persons` | boolean | yes | Whether persons interact with it directly (a chat assistant). |
| `human_review` | boolean | yes | Whether a human checks the output before it is used or published. |
| `marking` | string | no | How the person is told it is AI, or how the output is marked (AI Act Art. 50). Absent when nothing is done. |
| `role` | enum | no | **(v0.2)** The organisation's AI Act role for this feature: `provider` (it develops the AI system or has it developed and puts it into service under its own name), `deployer` (it uses an AI system under its authority), or `to-assess`. |
| `risk` | object | no | **(v0.2)** `level` (required): `prohibited` (Art. 5), `high` (Art. 6 and Annex III), `limited` (transparency obligations of Art. 50), `minimal`, or `to-assess`; `reason` (string, optional): why that level. |
| `obligations` | list | no | **(v0.2)** The AI Act obligations of the feature and their status: `{id, status, ref}`. See below. |
| `data` | list of ids | no | `personal_data` ids the feature uses. |
| `source`, `linked_files` | | | |

`obligations[]` **(v0.2)**:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | enum | yes | One of the obligation ids below. Unique within the list. |
| `status` | `done` \| `open` \| `not-applicable` | yes | `open` is an open item. `not-applicable` states that a person checked that the obligation does not apply. |
| `ref` | string | no | Where it is done: a document, a screen, a file. |

Obligation ids, with their article and when the dossier **expects** them. An expected obligation that is not listed is an open item; `not-applicable` counts as listed.

| Id | AI Act | Applies to | Expected when |
| --- | --- | --- | --- |
| `art4-ai-literacy` | Art. 4, AI literacy | providers and deployers | always |
| `art50-interaction` | Art. 50(1), persons told they interact with an AI system | providers | `interacts_with_persons: true` |
| `art50-synthetic-content` | Art. 50(2), generated content marked as such | providers | `generates_content: true` |
| `art50-emotion-biometric` | Art. 50(3), persons told of emotion recognition or biometric categorisation | deployers | never computed: listed by a person when it applies |
| `art50-deepfake` | Art. 50(4), deep fakes disclosed | deployers | never computed: listed by a person when it applies |
| `art9-risk-management` | Art. 9, risk management system | high risk | `risk.level: high` |
| `art10-data-governance` | Art. 10, data and data governance | high risk | `risk.level: high` |
| `art11-technical-documentation` | Art. 11, technical documentation | high risk | `risk.level: high` |
| `art12-logging` | Art. 12, record-keeping | high risk | `risk.level: high` |
| `art13-transparency` | Art. 13, transparency and instructions for use | high risk | `risk.level: high` |
| `art14-human-oversight` | Art. 14, human oversight | high risk | `risk.level: high` |
| `art15-accuracy-robustness` | Art. 15, accuracy, robustness and cybersecurity | high risk | `risk.level: high` |
| `art26-deployer-duties` | Art. 26, obligations of deployers | deployers of high risk | `risk.level: high` and `role: deployer` |
| `art27-fria` | Art. 27, fundamental rights impact assessment | deployers of high risk | `risk.level: high` and `role: deployer` |

The `art50-*` obligations follow the feature's flags, not its level: a `limited` chat assistant brings `art50-interaction` and, when it generates text, `art50-synthetic-content`. A deployer whose provider meets a provider obligation lists it as `not-applicable` with the provider's documentation in `ref`.

Open items of an AI feature: `role` absent or `to-assess`; `risk` absent or `level: to-assess`; `level: prohibited` (the feature is reviewed before anything else); an obligation with `status: open`; an expected obligation that is not listed.

## notices[] (v0.2)

Where the persons are told about the processing (GDPR Art. 13 and 14). A processing file points to them with `information.notices` (see [compliance-repo.md](compliance-repo.md)).

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | Referenced by processings as `{repo: <repo>, id: <id>}` or `{tool: <tool>, id: <id>}`. |
| `component` | id | no | Owning component. |
| `kind` | enum | yes | `page` (a privacy page), `screen` (an in-app screen), `banner` (a consent or cookie banner), `email`, or `none` (a person states that nothing tells the persons; the dossier keeps it open). |
| `ref` | string | yes | A URL, a file path or a screen name. |
| `source`, `linked_files` | | | |

## Validation

`node scripts/validate.mjs <manifest.yaml>` picks the schema from `spec_version` and checks it, and the rules JSON Schema cannot express: ids are unique within a list (and, in v0.2, within `service.components`, `notices` and each feature's `obligations`), and every `data` and `component` reference resolves (in v0.2, also `outbound_flows[].processor`).

## Decisions

This section records why the format is what it is.

### What v0.2 changed

v0.2 makes the compliance repo a dossier a DPO can review ([design](https://github.com/C2-POLY/compliance-spec/issues/28)). In the manifest:

| Need | Change in v0.2 |
| --- | --- |
| IP addresses and device identifiers had no category. | Category `connection`. |
| A flow to a processor was listed twice in the register, and its transfer safeguard was found by name. | `outbound_flows[].processor` (checked) and `outbound_flows[].safeguard`. |
| The register showed no contract. | `processors[].dpa_ref`; `dpa: no` or `unknown` becomes an open item. |
| One repo can hold a component its user controls (an offline app). | `service.components[].controller`, `service.controller_rationale`. |
| Art. 25 had no place. | `service.privacy_by_design`. |
| Art. 13 and 14: how persons are told. | Top-level `notices`, referenced from processings. |
| The AI Act depends on the role and the risk level. | `ai_features[].role`, `.risk`, `.obligations` with fixed obligation ids. |

Every new field is optional, so a v0.1 manifest only needs `spec_version: "0.2"` to become a v0.2 one; what it lacks shows as open items.

### What the v0 trial changed

Before any schema existed, a manifest was written by hand on a real desktop app, to see what a real repo needs ([findings and discussion](https://github.com/C2-POLY/fourchette/issues/238)). The five planned sections were enough and a `source` on every item worked. A hand-written manifest on a real desktop app showed that the format needed to change in nine places:

| Finding | Change in v0.1 |
| --- | --- |
| The controller is not always the organisation: a local app is controlled by its user. | `service.controller` (`organisation`, `user-of-the-app`, `shared`); `legal_basis` accepts `not-applicable`. |
| Recipients reached with the user's own accounts are not processors. | `processors` is limited to contracted providers (with `dpa`); every other recipient is an `outbound_flow` with `account`. |
| One repo, several deliverables. | `service.components[]`, and an optional `component` on items. One manifest per repo is kept; no per-deliverable manifest. |
| Repository or user content can hold anything. | Category `unknown`. |
| Retention is often an event, not a duration. | `retention.duration` (ISO 8601, `none`, `session`, `unknown`) plus a free-text `trigger`. |
| Transfers outside the EU matter. | `country` is required on processors and outbound flows; `safeguard` on processors. |
| Automated decisions mixed decisions about persons and AI-generated content. | Two lists: `automated_decisions` (persons, Art. 22) and `ai_features` (Art. 50: `generates_content`, `human_review`, `marking`). |
| Credentials are worth tracking. | Category `credential`. |
| A document disagreed with the code. | Not a field: the `source` on every item, with the rule that the code wins, makes the mismatch visible. |

Smaller changes: `data` in flows and storage is a list of `personal_data` ids (checked), not free text; `uses_ai` and `transparency_notice` of the trial are replaced by the `ai_features` list; `kind` per service is replaced by `components[].kind`.

### Dropped or deferred

- **Security measures per storage**: required by the Art. 30 register, but nothing in the code states them. They are declared by a person in `processing.yaml` (`security_measures`).
- **`legal_basis` is optional** in the manifest: it is a legal choice, meaningful only when the organisation is the controller, and a scan cannot read it.
- **Frequency and trigger of a flow** (hourly, on click): not in v0.1. They describe behaviour more than data, and no document of the register needs them yet.
- **Detecting declared values that contradict the code** automatically: deferred. v0.1 only records provenance.
- **Per-item staleness** (lag per item from per-item `linked_files`): deferred. The lag is computed on the root `linked_files` only.
- **Cross-manifest references** (a flow pointing to another repo of the organisation): deferred.
- **Free-text categories**: refused. A closed `category` enum keeps registers comparable; `unknown` and `special` are the escape hatches.

## Worked example

Bistro Booking is a fictional restaurant booking app. This manifest is for its `bistro-api` repo: a web API and a background worker (two components). The web frontend has its own manifest in the [complete example](../examples/bistro-booking/). This example is the v0.2 manifest of [`examples/bistro-booking/services/bistro-api/manifest.yaml`](../examples/bistro-booking/services/bistro-api/manifest.yaml); a test keeps the two copies identical. Its v0.1 form is [`tests/fixtures/valid/manifest/bistro-api.yaml`](../tests/fixtures/valid/manifest/bistro-api.yaml), kept with the v0.1 example in [`tests/fixtures/v0.1/bistro-booking/`](../tests/fixtures/v0.1/bistro-booking/).

```yaml
spec_version: "0.2"

service:
  name: Bistro Booking API
  repo: bistro-org/bistro-api
  description: Booking API and background worker of Bistro Booking, a table booking app for restaurants.
  controller: organisation
  components:
    - {id: api, kind: web-api}
    - {id: worker, kind: background-worker}
  source: {kind: declared, ref: "README.md"}

personal_data:
  - id: guest-contact
    component: api
    subjects: [restaurant guests]
    fields:
      - {name: guest name, category: identity}
      - {name: guest email, category: contact}
      - {name: guest phone number, category: contact}
    purpose: confirm, change and remind table bookings
    legal_basis: contract
    source: {kind: code, ref: "src/bookings/guest.ts"}
    linked_files: ["src/bookings/**"]

  - id: booking-details
    component: api
    subjects: [restaurant guests]
    fields:
      - {name: party size, category: usage}
      - {name: booking date and time, category: usage}
      - {name: dietary notes (free text), category: special}
    purpose: prepare the table and the kitchen
    legal_basis: contract
    source: {kind: code, ref: "src/bookings/booking.ts"}
    linked_files: ["src/bookings/**"]

  - id: payment-reference
    component: api
    subjects: [restaurant guests]
    fields:
      - {name: payment provider customer id, category: financial}
      - {name: card brand and last four digits, category: financial}
    purpose: hold and charge the booking deposit
    legal_basis: contract
    source: {kind: code, ref: "src/payments/deposit.ts"}
    linked_files: ["src/payments/**"]

  - id: no-show-history
    component: worker
    subjects: [restaurant guests]
    fields:
      - {name: number of past no-shows, category: usage}
      - {name: no-show risk score, category: usage}
    purpose: ask a deposit for bookings that are likely not to be honoured
    legal_basis: legitimate-interests
    source: {kind: spec, ref: "https://github.com/bistro-org/bistro-api/issues/42"}
    linked_files: ["src/scoring/**"]

  - id: staff-accounts
    component: api
    subjects: [restaurant staff]
    fields:
      - {name: staff email, category: contact}
      - {name: password hash, category: credential}
    purpose: sign staff in to the back office
    legal_basis: legitimate-interests
    source: {kind: code, ref: "src/auth/staff.ts"}
    linked_files: ["src/auth/**"]

  - id: request-metadata
    component: api
    subjects: [restaurant guests]
    fields:
      - {name: IP address of the booking request, category: connection}
      - {name: browser user agent, category: connection}
    purpose: protect the booking API against abuse and fake bookings
    legal_basis: legitimate-interests
    source: {kind: code, ref: "src/middleware/rate-limit.ts"}
    linked_files: ["src/middleware/**"]

storage:
  - id: main-db
    kind: database
    location: PostgreSQL, EU region (Frankfurt), managed by the hosting provider
    data: [guest-contact, booking-details, payment-reference, no-show-history, staff-accounts]
    retention: {duration: P3Y, trigger: after the last booking of the guest}
    source: {kind: code, ref: "db/migrations/**"}
    linked_files: ["db/migrations/**"]

  - id: staff-sessions
    kind: cache
    location: Redis, EU region (Frankfurt)
    data: [staff-accounts]
    retention: {duration: PT12H, trigger: sign-out or expiry of the session}
    source: {kind: code, ref: "src/auth/session.ts"}

  - id: app-logs
    kind: log
    location: log service of the hosting provider, EU region
    data: [guest-contact, request-metadata]
    retention: {duration: P30D, trigger: log rotation}
    source: {kind: declared, ref: "docs/operations.md"}

processors:
  - id: textflow-sms
    component: worker
    name: TextFlow SMS
    service: SMS booking reminders
    country: NL
    dpa: "yes"
    dpa_ref: "TextFlow SMS data processing agreement, signed 2025-09-02"
    transfer_outside_eu: false
    data: [guest-contact]
    source: {kind: code, ref: "src/notifications/sms.ts"}

  - id: mailrelay
    component: worker
    name: MailRelay
    service: transactional email (confirmations, reminders)
    country: FR
    dpa: "yes"
    dpa_ref: "MailRelay standard data processing terms, version 2025"
    transfer_outside_eu: false
    data: [guest-contact, booking-details]
    source: {kind: code, ref: "src/notifications/email.ts"}

  - id: paygate
    component: api
    name: PayGate
    service: card deposits
    country: US
    dpa: "yes"
    dpa_ref: "PayGate data processing addendum, signed 2025-11-20"
    transfer_outside_eu: true
    safeguard: standard contractual clauses
    data: [guest-contact, payment-reference]
    source: {kind: code, ref: "src/payments/deposit.ts"}

outbound_flows:
  - id: send-sms
    component: worker
    to: {name: TextFlow SMS, country: NL}
    data: [guest-contact]
    purpose: send the booking reminder by SMS
    account: organisation
    source: {kind: code, ref: "src/notifications/sms.ts"}

  - id: send-email
    component: worker
    to: {name: MailRelay, country: FR}
    data: [guest-contact, booking-details]
    purpose: send the booking confirmation and reminder by email
    account: organisation
    source: {kind: code, ref: "src/notifications/email.ts"}

  - id: charge-deposit
    component: api
    to: {name: PayGate, country: US}
    data: [guest-contact, payment-reference]
    purpose: hold and charge the booking deposit
    account: organisation
    processor: paygate
    source: {kind: code, ref: "src/payments/deposit.ts"}

  - id: calendar-link
    component: api
    to: {name: the calendar application chosen by the guest, country: unknown}
    data: [booking-details]
    purpose: let the guest add the booking to their own calendar
    account: user
    safeguard: "The guest adds the booking to a calendar of their choice with their own account; the service only offers the link."
    source: {kind: code, ref: "src/bookings/calendar.ts"}

automated_decisions:
  - id: deposit-for-risky-bookings
    component: worker
    description: A booking whose no-show risk score is above a threshold requires a deposit. A manager can waive the deposit.
    legal_or_similar_effect: false
    human_review: true
    source: {kind: spec, ref: "https://github.com/bistro-org/bistro-api/issues/42"}
    linked_files: ["src/scoring/**"]

ai_features:
  - id: no-show-prediction
    component: worker
    description: A statistical model predicts the no-show risk of a booking from the guest's booking history.
    generates_content: false
    interacts_with_persons: false
    human_review: true
    marking: Internal score, never shown to guests; the guest is told that a deposit may be asked.
    role: provider
    risk: {level: limited, reason: "The score only asks for a deposit that a manager can waive; it is not an Annex III use."}
    obligations:
      - {id: art4-ai-literacy, status: open}
    data: [no-show-history]
    source: {kind: spec, ref: "https://github.com/bistro-org/bistro-api/issues/42"}
    linked_files: ["src/scoring/**"]

  - id: booking-assistant
    component: api
    description: A chat assistant answers guests' questions about opening hours and menus.
    generates_content: true
    interacts_with_persons: true
    human_review: false
    marking: The chat window starts with "You are talking to an AI assistant".
    role: to-assess
    risk: {level: limited, reason: "A chat assistant that talks to guests: transparency obligations only."}
    obligations:
      - {id: art4-ai-literacy, status: done, ref: "AI training of the support team, 2026"}
      - {id: art50-interaction, status: done, ref: "The chat window starts with \"You are talking to an AI assistant\"."}
    source: {kind: code, ref: "src/assistant/chat.ts"}
    linked_files: ["src/assistant/**"]

linked_files:
  - "src/bookings/**"
  - "src/payments/**"
  - "src/notifications/**"
  - "src/scoring/**"
  - "src/auth/**"
  - "src/assistant/**"
  - "src/middleware/**"
  - "db/migrations/**"
  - "package.json"
```
