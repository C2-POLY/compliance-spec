# Compliance repo layout, v0.2

> Status: draft. Schemas are in [`schema/v0.2/`](../schema/v0.2/) and [`schema/v0.1/`](../schema/v0.1/).

An organisation has one **compliance repo**. It holds no code. It gathers the manifests of every repo of the information system, organised by **processing activity**, and the documents generated from them: in v0.2, a compliance dossier a DPO can review (the GDPR Art. 30 records of processing, the DPO checks of each processing, the AI features, and what stays outside the register); in v0.1, the records of processing only. A complete v0.2 example is in [`examples/bistro-booking/`](../examples/bistro-booking/); the v0.1 example is kept in [`tests/fixtures/v0.1/bistro-booking/`](../tests/fixtures/v0.1/bistro-booking/).

Fields marked **(v0.2)** are new in v0.2 and rejected in a v0.1 file. **(v0.2.1)** marks what the v0.2.1 release added: optional, accepted with `spec_version: "0.2"` (see [stability.md](stability.md)).

```
compliance.yaml                      the repos and tools of the information system
anchors.yaml                         the commit each document was generated from
actions.yaml                         optional: who closes which action of the dossier (v0.2.1)
processings/<id>/processing.yaml     one processing activity
services/<repo>/manifest.yaml        the manifest of a repo, as last sent
services/<repo>/sync.yaml            when it was sent, and how far the repo is ahead
declared/<tool>/manifest.yaml        hand-declared manifest of an external tool
documents/                           generated documents (documents/register.md ...)
```

## Versions

Each file declares its own `spec_version`, and the validator picks the schema directory from it (`schema/v0.1/` or `schema/v0.2/`).

- A **v0.2 compliance repo** is one whose `compliance.yaml` has `spec_version: "0.2"`. Its generator writes the v0.2 dossier ([rules](../templates/register/README.md#v02-the-compliance-dossier)), in English or French (`documents/register.md` either way).
- A v0.2 compliance repo may hold v0.1 and v0.2 manifests and processing files: a repo that has not upgraded keeps sending its v0.1 manifest. A v0.2 field missing from a v0.1 file is an open item of the dossier, never an error.
- A **v0.1 compliance repo** keeps the v0.1 register, unchanged.
- `actions.yaml` exists only in v0.2 (`spec_version: "0.2"`).
- `sync.yaml` and `anchors.yaml` have the same shape in both versions; a v0.2 copy only changes `spec_version`. Both are accepted in either kind of repo.

## Who writes what

| Path | Written by | Schema | Notes |
| --- | --- | --- | --- |
| `compliance.yaml` | a human | [compliance](compliance-yaml.md) | Which repos exist, who owns them, which must send. |
| `actions.yaml` | a human | `actions.schema.json` | **(v0.2.1)** Optional. Who answers for which role and scope, and who closes which action. See [actions.yaml](#actionsyaml-v021). |
| `processings/<id>/processing.yaml` | a human | `processing.schema.json` | The processing activity and what only a person knows. |
| `services/<repo>/manifest.yaml` | the Action | `manifest.schema.json` | A copy of the repo's `.compliance/manifest.yaml`. Never edited by hand. |
| `services/<repo>/sync.yaml` | the Action | `sync.schema.json` | Rewritten at every sync. |
| `declared/<tool>/manifest.yaml` | a human | `manifest.schema.json` | Every item has `source.kind: declared`. |
| `documents/**` | the generator | none | Overwritten at every generation. |
| `anchors.yaml` | the generator | `anchors.schema.json` | Rewritten at every generation. |

Files written by a tool are never edited by hand; a fix goes to the source (the repo's manifest) and arrives at the next sync.

## Validation by a person

**A DPO validation is an approved, merged pull request on the compliance repo.** The Action and the generator open pull requests; nothing they write reaches the default branch without a human review. The review, its reviewer and its date are the validation record. **(v0.2.1)** A processing file may also record the DPO's approval of its content in [`review`](#review-v021); the merged pull request stays the record of the merge, which a technical maintainer may do. A document on the default branch is a validated one; a document in an open pull request is a draft.

## processings/&lt;id&gt;/processing.yaml

One file per processing activity (a purpose, a set of data subjects, a legal basis), whatever the number of repos involved. The folder name equals `id`.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.2"` (or `"0.1"`). |
| `id` | id | yes | `^[a-z0-9][a-z0-9-]*$`; equals the folder name. |
| `name` | string | yes | Human name. |
| `purpose` | string | yes | Why the data is processed. |
| `controller` | `{name, contact}` | v0.1: yes; v0.2: no | The controller of this processing (Art. 30(1)(a)). **(v0.2)** Optional: absent, the dossier uses `organisation.controller` of `compliance.yaml`; present, it wins. |
| `dpo` | `{name, contact}` | no | The data protection officer, when there is one. **(v0.2)** Absent, the dossier uses `organisation.dpo` of `compliance.yaml`; present, it wins. |
| `joint_controllers` | list | no | **(v0.2)** The joint controllers (Art. 26): `{name, contact, arrangement}`, all three required; `arrangement` is the arrangement between them or where it is. `[]` means none, stated by a person. Absent means not confirmed: an open item. |
| `data_subjects` | list of strings | yes | Categories of persons. |
| `legal_basis` | enum | yes | Same values as in the manifest: `consent`, `contract`, `legal-obligation`, `vital-interests`, `public-task`, `legitimate-interests`, `not-applicable`. |
| `legal_basis_detail` | object | no | **(v0.2)** What documents the legal basis. See [DPO checks](#dpo-checks-v02). |
| `dpia` | object | no | **(v0.2)** Whether a data protection impact assessment (Art. 35) is required. See [DPO checks](#dpo-checks-v02). |
| `information` | object | no | **(v0.2)** How the persons are told (Art. 13 and 14). See [DPO checks](#dpo-checks-v02). |
| `sensitive_data` | `none` \| `to-assess` \| list | no | **(v0.2)** Special categories of data (Art. 9). See [DPO checks](#dpo-checks-v02). |
| `services` | list | yes | The repos and tools involved. Each entry has `repo` (a name from `compliance.yaml`) **or** `tool` (a `declared_tools` id), and optionally `data`: the `personal_data` ids of that service's manifest that belong to this processing (no `data` means all of them), and `recipients`: the `processors` and `outbound_flows` ids of that manifest that belong to this processing (no `recipients` means those that share an id with the entry's `data` scope; `recipients: []` means none). |
| `security_measures` | list | no | `{measure, source}`: technical and organisational measures (Art. 30(1)(g)). |
| `recipients` | list | no | `{name, source}`: recipients (Art. 30(1)(d)) the manifests do not already show. |
| `retention` | object | no | `{duration, trigger, source}`: overrides the retention of the manifests for this processing. `duration` has the manifest format. |
| `review` | object | no | **(v0.2.1)** The DPO's approval of this processing. See [Review](#review-v021). |
| `source` | source | yes | Provenance of the file. |

Every declared value carries a `source` (`kind: declared` in practice, with the person or document in `ref`), as in the manifests. Values without a `source` of their own (`controller`, `dpo`, `joint_controllers`, the DPO checks) take the file's `source`.

### DPO checks (v0.2)

Every field is optional in the schema: a processing is written while people work, before every answer is known. Absent, or with the value `to-assess`, a check is an **open item** of the dossier.

```yaml
legal_basis_detail:
  balancing_test: {interest: "…", necessity: "…", impact: "…", safeguards: "…"}
  consent: {collection: "…", withdrawal: "…"}
  reference: "…"
dpia:
  required: "yes"
  criteria: [evaluation, sensitive]
  ref: "DPIA-2026-01, table bookings"
information:
  notices: [{repo: bistro-web, id: privacy-page}]
  text: "…"
sensitive_data: [health, religious]
```

| Field | Meaning | Open item when |
| --- | --- | --- |
| `legal_basis_detail.balancing_test` | `interest`, `necessity`, `impact`, `safeguards` (all four required): the balancing test of legitimate interests (Art. 6(1)(f)). | `legal_basis` is `legitimate-interests` and it is absent. |
| `legal_basis_detail.consent` | `collection`, `withdrawal` (both required): how consent is collected and withdrawn (Art. 7). | `legal_basis` is `consent` and it is absent. |
| `legal_basis_detail.reference` | The contract, law, public task or vital interest the processing relies on. | `legal_basis` is `contract`, `legal-obligation`, `public-task` or `vital-interests` and it is absent. |
| `dpia.required` | `yes`, `no` or `to-assess` (required when `dpia` is present). Quote `"yes"` and `"no"`. | `dpia` is absent, `required` is `to-assess`, or `required` is `yes` without `ref`. |
| `dpia.criteria` | The EDPB criteria that apply: `evaluation`, `automated-decision`, `monitoring`, `sensitive`, `large-scale`, `matching`, `vulnerable`, `innovative`, `prevents-rights`. `[]` means none. | never |
| `dpia.ref` | The DPIA document, when one exists. | see `required` |
| `information.notices` | Notices of the manifests: `{repo: <repo>, id: <notice id>}`, or `{tool: <tool id>, id: <notice id>}` for a declared tool. Each must resolve to a `notices` entry of that service's manifest; an unresolved reference fails the generation, as an unresolved `data` does. | `information` is absent, or a notice it names has `kind: none`. |
| `information.text` | Free text: how else the persons are told. `information` needs `notices` or `text`. | |
| `sensitive_data` | `none`, `to-assess`, or the Art. 9 categories found: `racial-ethnic`, `political`, `religious`, `union`, `genetic`, `biometric`, `health`, `sex-life`, `criminal`. | absent or `to-assess`. |

`legal_basis: not-applicable` expects no detail. A detail written for another legal basis than the processing's is ignored by the dossier, and the expected one is still open.

A processing file with `spec_version: "0.1"` in a v0.2 compliance repo has none of these fields: each check, and its joint controllers, is an open item.

The full list of open items (identity, Art. 30, DPO checks, AI features, controllers outside the register) and the action that closes each one are in [`templates/register/README.md`](../templates/register/README.md#v02-the-compliance-dossier).

### Review (v0.2.1)

Reserved for the DPO's approval of the processing, distinct from the technical merge of the pull request that changes it: a maintainer may merge a processing file the DPO has not approved yet.

```yaml
review:
  status: validated
  by: Data protection office
  date: 2026-11-10
  pr: https://github.com/bistro-org/bistro-compliance/pull/4
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `status` | `draft` \| `ready` \| `validated` | yes | `draft`: being written; `ready`: ready for the DPO; `validated`: approved by the DPO. |
| `by` | string | no | Who reviewed: a person, a role or a team. |
| `date` | date (`YYYY-MM-DD`) | no | When. |
| `pr` | string | no | The pull request of the review: its URL, or `#<number>` in the compliance repo. |

The dossier does not read `review` yet: a processing reads the same with or without it.

## services/&lt;repo&gt;/sync.yaml

Written by the Action every time a repo sends its manifest after a merge.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"` or `"0.2"`; the shape is the same. |
| `repo` | string | yes | Repo name, equal to the folder name. |
| `sha` | 40-hex SHA | yes | The commit of the repo whose manifest was sent. |
| `received_at` | RFC 3339 date-time | yes | When the compliance repo received it. |
| `lag` | object | yes | How far the repo is ahead of the documents. Either `{status: unknown}` or `{anchor, count, commits}` below. |

`lag`, when known:

| Field | Type | Meaning |
| --- | --- | --- |
| `anchor` | SHA or `null` | The anchor of this repo in `anchors.yaml` when the lag was computed. `null`: no document was ever generated for this repo. |
| `count` | integer | Number of commits since the anchor that touch the manifest's `linked_files`: the length of `git log <anchor>..<sha> -- <linked files>`. |
| `commits` | list of SHAs | Those commits, newest first. `count` equals the length of this list. |

`{status: unknown}` is used when the lag cannot be computed (the anchor is not in the repo's history after a force-push, the manifest has no `linked_files`). With `anchor: null`, `count` is `0` and `commits` is `[]`: the question is not "how far", it is "never documented". A repo with `count: 0` is in sync with its documents.

## declared/&lt;tool&gt;/manifest.yaml

A manifest for something with no repo to scan: a hosted CRM, a payroll tool, a spreadsheet. It uses the manifest schema; `service.repo` is absent, every `source.kind` is `declared`, and there is no `linked_files` (so no lag). The tool is listed in `compliance.yaml` under `declared_tools` and referenced from a processing with `tool: <id>`.

## actions.yaml (v0.2.1)

Optional, at the root of the compliance repo, written by a human. It names who answers for each role of the dossier's actions (`organisation`, `dpo`, `developer`, see [Actions](../templates/register/README.md#actions)) and who closes which action. Its free texts follow the [language](compliance-yaml.md#language-v021) of the compliance repo.

```yaml
spec_version: "0.2"
contacts:
  - {id: data-protection-office, role: dpo, name: Data protection office, contact: dpo@bistro-booking.example, scope: [organisation]}
  - {id: platform-team, role: developer, name: platform team, contact: platform@bistro-booking.example, scope: [bistro-api, bistro-web]}
assignments:
  - {action: legal-basis-detail, contact: data-protection-office, scope: marketing-emails, due: 2026-12-15}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.2"`. |
| `contacts` | list | yes | Who answers for a role. May be `[]`. |
| `assignments` | list | no | Who closes which action. |

`contacts[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | Unique in `contacts`; referenced by `assignments[].contact`. |
| `role` | `organisation` \| `dpo` \| `developer` | yes | The role of the actions it answers for. |
| `name` | string | yes | A person, a role or a team. |
| `contact` | string | yes | How to reach them. |
| `scope` | list of strings | no | The repo names of `compliance.yaml` it answers for, or `organisation`. Absent: everything. |

`assignments[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `action` | enum | yes | An action id of the dossier ([Actions](../templates/register/README.md#actions)): `organisation-identity`, `organisation-dpo`, `organisation-representative`, `joint-controllers`, `personal-data`, `transfer-safeguards`, `processor-contracts`, `retention`, `security-measures`, `legal-basis-detail`, `dpia`, `information`, `sensitive-data`, `ai-classification`, `ai-obligations`, `controller-rationale`. |
| `contact` | id | yes | A `contacts` id of this file. |
| `scope` | string | no | A processing id, a repo name, or `organisation`. Absent: every open item of the action. |
| `due` | date (`YYYY-MM-DD`) | no | When it should be closed. |
| `note` | string | no | Free text. |

`node scripts/validate.mjs actions.yaml` checks the schema, that contact ids are unique, and that every `assignments[].contact` resolves. The dossier does not read `actions.yaml` yet: the Actions section is the same with or without it.

## anchors.yaml

Written by the generator each time it generates documents. It records, for each repo, the commit the generated documents are based on. The lag of the next sync is counted from it.

```yaml
spec_version: "0.2"
generated_at: "2026-03-11T08:00:00Z"
repos:
  bistro-api:
    sha: "4b8d2f6a0c1e9375a2d4f6b8c0e2a4d6f8b1c3e5"
  bistro-web:
    sha: "9d3f6b1a4c7e0258b1d4f7a0c3e6b9d2f5a8c1e4"
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"` or `"0.2"`; the shape is the same. The v0.2 generator writes `"0.2"`. |
| `generated_at` | RFC 3339 date-time | yes | When the documents were generated. |
| `repos` | map | yes | Keyed by repo name (a name from `compliance.yaml`). Each value is `{sha}`. |
| `repos.<name>.sha` | 40-hex SHA | yes | The `sha` of `services/<name>/sync.yaml` that was read to generate the documents. |

Rules:

1. The anchor of a repo is the `sha` its `sync.yaml` had **at generation time**. The generator copies it; it never invents one.
2. The anchor moves only when documents are generated. Merging a sync does not move it, which is how the lag grows.
3. Anchors are written in the same pull request as the documents. Until a DPO merges that pull request, the default branch keeps the previous anchors, so the lag keeps counting from the last validated documents.
4. Declared tools have no anchor: they have no commits.
5. A repo absent from `repos` has never been documented; its lag anchor is `null`.

The lag of a repo is then `git log <anchor>..<sha> -- <linked_files>`, run by the Action in the repo, where `<sha>` is the commit being synced and `<linked_files>` the root `linked_files` of its manifest.
