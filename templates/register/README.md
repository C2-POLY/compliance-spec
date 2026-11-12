# Records of processing activities: base template

> Status: draft, v0.1. Refs: [compliance-spec#14](https://github.com/C2-POLY/compliance-spec/issues/14).

The template of the GDPR Art. 30(1) records of processing activities (controller side), and the rules to fill it from a compliance repo. A generator (the `register` mode of [compliance-action](https://github.com/C2-POLY/compliance-action)) implements these rules by hand, without a template library, and must produce the same bytes as the golden output [`examples/bistro-booking/documents/register.md`](../../examples/bistro-booking/documents/register.md) for the Bistro Booking example. A test checks the golden file.

| File | Role |
| --- | --- |
| [`register.md.tmpl`](register.md.tmpl) | The layout: front matter, title, preface, open items, one section per processing activity |
| this README | The mapping from the register items to the source fields, and the rules |

The register is prepared for review by the controller and its DPO. It does not certify compliance.

## Art. 30(1) items

| | Item (GDPR Art. 30(1)) |
| --- | --- |
| (a) | Name and contact details of the controller and, where applicable, of the joint controller, the controller's representative and the data protection officer |
| (b) | The purposes of the processing |
| (c) | A description of the categories of data subjects and of the categories of personal data |
| (d) | The categories of recipients, including recipients in third countries |
| (e) | Transfers of personal data to a third country, and the documentation of suitable safeguards |
| (f) | Where possible, the envisaged time limits for erasure of the different categories of data |
| (g) | Where possible, a general description of the technical and organisational security measures |

## Inputs

The generator reads a compliance repo (see [compliance-repo.md](../../spec/compliance-repo.md)) and two values given by its caller:

- `generated_at`: an RFC 3339 date-time, **given by the caller**. The generator never reads the clock.
- the compliance repo: `compliance.yaml`, `processings/*/processing.yaml`, `services/<repo>/manifest.yaml` and `sync.yaml`, `declared/<tool>/manifest.yaml`.

### Scope of a processing

For a processing `P`, each entry of `P.services` resolves to a manifest: `repo: <r>` to `services/<r>/manifest.yaml`, `tool: <t>` to the `path` of the `declared_tools` entry `<t>` in `compliance.yaml`. The entry's **scope** is the set of `personal_data` ids of that manifest named by its `data` filter, or all of them when `data` is absent. Below, "in scope" always means "of an entry of `P.services`, within its scope":

- a `personal_data` item is in scope when its id is in the entry's scope;
- a `storage` item is in scope when its `data` list shares at least one id with the entry's scope;
- a `processors` or `outbound_flows` item (the recipients) is in scope, when the entry has `recipients`, if and only if its id is in that list (`recipients: []` means none). Without `recipients`, it is in scope when its `data` list shares at least one id with the entry's scope; a processor with no `data` is in scope.

Nothing else of the manifests is read: `automated_decisions` and `ai_features` are not part of Art. 30. `service.controller` is not read either.

The generation **fails** (the generator reports it and writes nothing) when a `repo` of `P.services` has no `services/<r>/manifest.yaml` or no `sync.yaml`, when a `tool` is not in `compliance.yaml`, or when its manifest file is missing. A register that silently omits a service would look complete.

## Mapping

Every row of a section is built as `(item, value, provenance)`. In the table, "m." is the manifest of an entry of `P.services`.

| Item | Rendered value | Source fields | Merge rule |
| --- | --- | --- | --- |
| (a) Controller | `<name>, <contact>` | `processing.controller.name`, `.contact` | One row. |
| (a) Joint controller | `To complete` | none in v0.1 | Always `To complete`. |
| (a) Representative | `To complete` | none in v0.1 | Always `To complete`. |
| (a) Data protection officer | `<name>, <contact>` | `processing.dpo.name`, `.contact` | One row; `To complete` when `dpo` is absent. |
| (b) Purposes | the text | `processing.purpose` | One row. The purposes of the manifests' `personal_data` items are not listed: a data set shared with another processing would bring that processing's purpose here. |
| (c) Data subjects | the text | `processing.data_subjects[]`; m. `personal_data[].subjects[]` | Union, de-duplicated, sorted. |
| (c) Personal data | `<category>: <name>, <name>` | m. `personal_data[].fields[]` (`category`, `name`) | One row per (in-scope `personal_data` item, category): the field names of that item in that category, de-duplicated, sorted. Rows with the same value and the same source are merged. Rows are sorted by value, then by source. |
| (d) Recipients | `<name> (<country>)` | m. `processors[].name`, `.country`; m. `outbound_flows[].to.name`, `.to.country` (both filtered by `services[].recipients`); `processing.recipients[].name` | Union of the three, see below. Sorted. |
| (e) Transfers | `<name> (<country>): <safeguard>` | m. `processors[].transfer_outside_eu`, `.safeguard`, `.country`; m. `outbound_flows[].to.country` | See below. Sorted. |
| (f) Erasure time limits | `<duration>[, <trigger>]` | `processing.retention`; m. `storage[].retention` | `processing.retention` wins: when present it is the only row. Otherwise one row per in-scope `storage` item. |
| (g) Security measures | the text | `processing.security_measures[].measure` | Sorted. The manifests state no measure. |

`compliance.yaml` is also read: `organisation.name` fills the preface, `repos[].name` and `declared_tools[]` resolve the entries of `P.services`.

### Recipients (d)

1. For each in-scope processor: `<name> (<country>)`.
2. For each in-scope outbound flow: `<to.name> (<to.country>)`, with `country unknown` written `(country unknown)`. **Except** when `to.name` is equal to the `service.name` of a manifest of the compliance repo: that flow stays inside the information system and is not a recipient.
3. For each `processing.recipients[]`: its `name`, **except** when it names a recipient of 1 or 2: equal to its `<name>` or starting with `<name> (` (so `TextFlow SMS (SMS reminders)` is the same recipient as `TextFlow SMS`).
4. A value that comes from several items is one row (see Provenance).

### Transfers (e)

A transfer exists for a recipient (same `<name>` and `<country>`) when:

- an in-scope processor has `transfer_outside_eu: true`, whatever its country; or
- an in-scope outbound flow has a `to.country` that is neither in the EU/EEA list below nor `unknown`.

The value is `<name> (<country>): <safeguard>`, where `<safeguard>` is the `safeguard` of the in-scope processor of the same name and country, else `safeguard not declared`. A flow whose `to.country` is `unknown` gives `<name> (country unknown): destination to assess`. No transfer found: the single row `None identified in the sources`.

EU/EEA country codes (EU member states plus Iceland, Liechtenstein and Norway), fixed by this version of the template; a change of the list is a change of the template version:

`AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE`

A country outside the list is a third country, even when an adequacy decision exists: the adequacy decision is the safeguard, written in the `safeguard` field.

### Erasure time limits (f)

- With `processing.retention`: one row `<duration>[, <trigger>]`.
- Without: one row per in-scope `storage` item, `<storage id> (<kind>): <duration>[, <trigger>]`.
- `<duration>` is written as in the source: an ISO 8601 duration (`P3Y`), `none`, `session` or `unknown`. No conversion. `unknown` stays `unknown`: a reviewer treats it as open.
- No `processing.retention` and no in-scope `storage`: `To complete`.

## Provenance

The Source cell holds exactly one string per row:

| Form | Used for |
| --- | --- |
| `code: <repo>@<sha7>:<ref>` | a manifest item with `source.kind: code`. `<repo>` is the folder name under `services/`; `<sha7>` is the first 7 characters of `sha` in `services/<repo>/sync.yaml`; `<ref>` is `source.ref`, verbatim. |
| `spec: <url>` | an item with `source.kind: spec`. `<url>` is `source.ref`, verbatim. |
| `declared: <ref>` | a value of `processing.yaml`: `<ref>` is the `source.ref` of the value, or the file's `source.ref` when the value has none of its own (`controller`, `dpo`, `purpose`, `data_subjects`). |
| `declared: <file> (<ref>)` | a manifest item with `source.kind: declared`. `<file>` is the path of the manifest in the compliance repo (`services/<repo>/manifest.yaml` or `declared/<tool>/manifest.yaml`), `<ref>` is `source.ref`. |
| `—` | no source: the value is `To complete` or `None identified in the sources`. |

A `code` item found in a declared tool manifest (it has no sync) is written in the `declared: <file> (<ref>)` form. In a `processing.yaml`, `kind: spec` is written `spec: <url>` and `kind: code` is written `declared: <ref>` (a processing file has no sync).

When one **atomic** value (a text stated identically by several items: subjects, purposes, recipients, transfers) comes from several items, there is one row and one source: the strongest, ordered by kind (`code`, then `spec`, then `declared`), then by ascending source string. A **composite** value (personal data) is built from one item, so the same value from two items gives two rows.

## Missing values

A value no source gives is `To complete`, with the source `—`. It is never invented, never guessed from another field. A search that finds nothing is not a missing value: recipients and transfers give `None identified in the sources`, also with `—`. Together with `To complete`, it is the only value that goes with `—`.

Always `To complete` in v0.1: joint controller and representative (the processing format has no field for them). Possibly: DPO, erasure time limits, security measures, recipients in a section.

A person who does not know a required text value of `processing.yaml` yet may write `to complete` (any case) in it: `controller.name`, `controller.contact`, `dpo.name` or `dpo.contact`. The generator writes it `To complete`, and the row is an open item. The source of the row does not change.

## Open items

Gaps are expected: processings and manifests are filled while people work, before every answer is known. The register keeps each gap visible and lists them first, so that a review starts with what is missing.

An **open item** of a processing is one of these, found in its section:

| Open item | Found when |
| --- | --- |
| `<item>` | the item has no source and reads `To complete`; for (a) Controller and (a) Data protection officer, also when a name or contact is written `to complete` |
| `(c) Personal data: category unknown` | an in-scope `personal_data` field has the category `unknown` |
| `(e) Transfers: safeguard not declared for <name> (<country>)` | a transfer exists for a recipient and no in-scope processor of the same name and country declares a `safeguard` |
| `(e) Transfers: destination to assess for <name> (country unknown)` | an in-scope outbound flow has `to.country: unknown` |
| `(f) Erasure time limits: unknown` | the `processing.retention` duration is `unknown` |
| `(f) Erasure time limits: unknown for <storage id>` | without `processing.retention`, an in-scope storage has the retention duration `unknown` |

Open items come from the source fields, never from the rendered text: a purpose, a name or a safeguard whose words look like a gap ("To complete our offers", "SCC, safeguard not declared") is a value.

`<item>` is the item label of the table above, for example `(g) Security measures`. Joint controller and representative are **not** open items: they are always `To complete` in v0.1 and could never be closed, which would hide the items that can. The section says so in one sentence.

The open items of a processing are listed in the order of their rows, each once, joined by `; `; a processing with none reads `None`. The count is the number of open items of all processings.

The summary line is:

- `No processing activity yet.` when there is no processing;
- `No open item in the <K> processing activities.` (`activity` when K is 1) when the count is 0;
- otherwise `<N> open item(s) in <M> of the <K> processing activities.`, with `item` when N is 1 and `activity` when K is 1, M being the number of processings with at least one open item.

None identified in the sources (recipients, transfers) is not an open item: the search ran and found nothing.

## Determinism

The same inputs give the same bytes.

- Text encoding UTF-8, line endings `\n`, no trailing whitespace, exactly one `\n` at the end of the file.
- Processings are sorted by `id`. The 11 items are always in the order of the table above, and always present.
- Values are sorted in ascending order of their UTF-16 code units (JavaScript `a < b`), with no locale. Where a rule says "sorted", that is the order; no other order is used.
- Row labels: the item label is on the first row of the item, the Item cell is empty on the others.
- A cell is on one line: a newline in a value becomes a space, `|` becomes `\|`, the value is trimmed.
- `generated_at` is copied from the caller's input as it is, without reformatting. Nothing else depends on a date or on the clock.
- Anchors are sorted by repo name.

## Output front matter

```yaml
---
spec_version: "0.1"
generated_at: "2026-11-11T00:00:00Z"
open_items: 2
anchors:
  bistro-api: "7c1e4f9a2b6d8035e1a4c7f90b2d6e8a1c3f5b79"
  bistro-web: "9d3f6b1a4c7e0258b1d4f7a0c3e6b9d2f5a8c1e4"
---
```

- `spec_version`: the template version, `"0.1"`.
- `generated_at`: the input.
- `open_items`: the count of open items, an integer (see Open items).
- `anchors`: for each repo named by a `repo` entry of any processing, the full `sha` of its `services/<repo>/sync.yaml` at generation time. It has the same content as `repos` and `generated_at` in the `anchors.yaml` that the generator writes in the same run ([anchors rules](../../spec/compliance-repo.md#anchorsyaml)). Repos no processing refers to, and declared tools, are not in it. The shas are double-quoted strings here and in `anchors.yaml` and `sync.yaml`, so that a sha made only of digits and `e` is never read as a number; the generator writes them quoted.

## Template syntax

[`register.md.tmpl`](register.md.tmpl) uses three constructs. The generator builds a context and replaces them by hand.

| Construct | Meaning |
| --- | --- |
| `{{name}}` | The value `name` of the current context, as text. Looked up in the innermost block first, then outwards. A missing name is a generator error. |
| `{{#each name}}` ... `{{/each}}` | Repeats the block for each element of the list `name`, in the list's order; the element is the current context. Blocks nest. |
| a line that holds only a block tag | Removed entirely, with its newline. |

No escaping, no conditions, no other tag. The values are escaped as said in Determinism before they are put in the context. After rendering, trailing blank lines are reduced to one final `\n`.

Context:

| Name | Where | Content |
| --- | --- | --- |
| `spec_version` | root | `"0.1"` (without the quotes) |
| `generated_at` | root | the input |
| `organisation` | root | `compliance.yaml` `organisation.name` |
| `open_items` | root | the count of open items |
| `open_summary` | root | the summary line of the open items |
| `open` | root | list of `{name, items}`, one per processing in the order of `processings`: `name` is `<name> (<id>)`, `items` the open items joined by `; ` or `None` |
| `anchors` | root | list of `{repo, sha}`, sorted by `repo` |
| `processings` | root | list of `{id, name, rows}`, sorted by `id` |
| `rows` | in a processing | the flat list of `{item, value, source}` of the 11 items in order |

Two special cases:

- With no anchor, the generator writes `anchors: {}` in place of the `anchors:` block.
- An empty `{{name}}` between two spaces leaves a single space, so a continuation row renders `| | value | source |`, not `|  | value | source |`.

## Limits of v0.1

- A shared `personal_data` id (`guest-contact` of Bistro Booking is used by two processings) brings the storages that hold it into every processing that uses it, and, without `services[].recipients`, the processors and flows that touch it. Recipients and transfers are then over-reported rather than missed; a processing file narrows them with `recipients`. Storages cannot be narrowed.
- One source per atomic value: the other items that state the same value are not shown. Enough for v0.1.
- No joint controller, representative, or "none" statement can be declared by a person.
