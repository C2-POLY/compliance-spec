# Compliance repo layout, v0.1

> Status: draft. Schemas are in [`schema/v0.1/`](../schema/v0.1/).

An organisation has one **compliance repo**. It holds no code. It gathers the manifests of every repo of the information system, organised by **processing activity**, and the documents generated from them (the GDPR Art. 30 records of processing). A complete example is in [`examples/bistro-booking/`](../examples/bistro-booking/).

```
compliance.yaml                      the repos and tools of the information system
anchors.yaml                         the commit each document was generated from
processings/<id>/processing.yaml     one processing activity
services/<repo>/manifest.yaml        the manifest of a repo, as last sent
services/<repo>/sync.yaml            when it was sent, and how far the repo is ahead
declared/<tool>/manifest.yaml        hand-declared manifest of an external tool
documents/                           generated documents (documents/register.md ...)
```

## Who writes what

| Path | Written by | Schema | Notes |
| --- | --- | --- | --- |
| `compliance.yaml` | a human | [compliance](compliance-yaml.md) | Which repos exist, who owns them, which must send. |
| `processings/<id>/processing.yaml` | a human | `processing.schema.json` | The processing activity and what only a person knows. |
| `services/<repo>/manifest.yaml` | the Action | `manifest.schema.json` | A copy of the repo's `.compliance/manifest.yaml`. Never edited by hand. |
| `services/<repo>/sync.yaml` | the Action | `sync.schema.json` | Rewritten at every sync. |
| `declared/<tool>/manifest.yaml` | a human | `manifest.schema.json` | Every item has `source.kind: declared`. |
| `documents/**` | the generator | none | Overwritten at every generation. |
| `anchors.yaml` | the generator | `anchors.schema.json` | Rewritten at every generation. |

Files written by a tool are never edited by hand; a fix goes to the source (the repo's manifest) and arrives at the next sync.

## Validation by a person

**A DPO validation is an approved, merged pull request on the compliance repo.** The Action and the generator open pull requests; nothing they write reaches the default branch without a human review. The review, its reviewer and its date are the validation record: the format adds no `validated_by` field to any file. A document on the default branch is a validated one; a document in an open pull request is a draft.

## processings/&lt;id&gt;/processing.yaml

One file per processing activity (a purpose, a set of data subjects, a legal basis), whatever the number of repos involved. The folder name equals `id`.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"`. |
| `id` | id | yes | `^[a-z0-9][a-z0-9-]*$`; equals the folder name. |
| `name` | string | yes | Human name. |
| `purpose` | string | yes | Why the data is processed. |
| `controller` | `{name, contact}` | yes | The controller of this processing (Art. 30(1)(a)). |
| `dpo` | `{name, contact}` | no | The data protection officer, when there is one. |
| `data_subjects` | list of strings | yes | Categories of persons. |
| `legal_basis` | enum | yes | Same values as in the manifest: `consent`, `contract`, `legal-obligation`, `vital-interests`, `public-task`, `legitimate-interests`, `not-applicable`. |
| `services` | list | yes | The repos and tools involved. Each entry has `repo` (a name from `compliance.yaml`) **or** `tool` (a `declared_tools` id), and optionally `data`: the `personal_data` ids of that service's manifest that belong to this processing. No `data` means all of them. |
| `security_measures` | list | no | `{measure, source}`: technical and organisational measures (Art. 30(1)(g)). |
| `recipients` | list | no | `{name, source}`: recipients (Art. 30(1)(d)) the manifests do not already show. |
| `retention` | object | no | `{duration, trigger, source}`: overrides the retention of the manifests for this processing. `duration` has the manifest format. |
| `source` | source | yes | Provenance of the file. |

Every declared value carries a `source` (`kind: declared` in practice, with the person or document in `ref`), as in the manifests.

## services/&lt;repo&gt;/sync.yaml

Written by the Action every time a repo sends its manifest after a merge.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"`. |
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

## anchors.yaml

Written by the generator each time it generates documents. It records, for each repo, the commit the generated documents are based on. The lag of the next sync is counted from it.

```yaml
spec_version: "0.1"
generated_at: "2026-03-11T08:00:00Z"
repos:
  bistro-api:
    sha: 4b8d2f6a0c1e9375a2d4f6b8c0e2a4d6f8b1c3e5
  bistro-web:
    sha: 9d3f6b1a4c7e0258b1d4f7a0c3e6b9d2f5a8c1e4
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.1"`. |
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
