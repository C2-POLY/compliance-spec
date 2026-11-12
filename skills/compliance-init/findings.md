# Findings format

The scan ([`scan.md`](scan.md)) ends in one file, `.compliance/findings.md`. It is the evidence: the manifest is drafted from it, and it stays in the pull request so a reviewer can check each line against the code. A worked file is in [`example/expected/findings.md`](example/expected/findings.md).

Rules:

- One table per manifest section, in the order below. A section with no finding keeps its heading and the line `None found.` (an empty list in the manifest is a statement, so say it).
- One row per finding. The `#` is a prefix and a number, unique in the file: `P` personal_data, `S` storage, `R` processors, `O` outbound_flows, `D` automated_decisions, `A` ai_features, `N` notices.
- **Where** is `path:line` or `path:first-last`, relative to the repo root, in backticks; several places are separated by commas. A file seen as a whole (a dependency list, a migration, a config file) may be given as `path` with no line. A finding without a file is not a finding.
- **Confidence** is `found` (the code shows it) or `inferred` (deduced; **What** says from what).
- **Becomes** lists one or more targets separated by commas: a manifest item as `<section>/<id>`, `question <n>` for a question the row raises (write `question 5, question 6` for two), or `out: <reason>` for something deliberately not in the manifest (for example `out: dev-only script`). Every row has at least one target.
- Never write a secret or a personal value: write the name of the variable or the category ("a secret is configured via `TEXTFLOW_API_KEY`").

## Template

````markdown
# Compliance findings

- Repo: `<owner>/<name>`
- Scanned commit: `<full sha>`
- Scanned on: `<date>`
- Scope: <what was scanned, e.g. "the whole repo" or "apps/api and apps/worker">

This file lists what the code shows. It prepares documentation; it does not certify compliance.

## personal_data

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| P1 | <what was seen, in one line> | `<path>:<line>` | found | personal_data/<id> |

## storage

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |

## processors

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |

## outbound_flows

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |

## automated_decisions

None found.

## ai_features

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |

## notices

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |

## Not counted

| What | Where | Why |
| --- | --- | --- |
| <seen but left out> | `<path>` | <test fixture, vendored, generated, dev-only, ...> |

Dev-only files that may hold personal data (a decision for a person, not a finding):

- `<path>`: <why it may hold personal data>

## Questions

What the code cannot tell. They are asked in one message; unanswered ones stay `unknown` or out of the manifest.

1. <question> (feeds <section>/<id>.<field>)
````

## Reading it

- The files of the **Where** column are the source of the manifest's root `linked_files`.
- Every `code` source in the manifest names a file that appears in this table.
- An item of the manifest with no row here is either declared by a person (an answer) or a mistake.
- The AI rows say what the code hints about the role, the risk and the obligations (`scan.md`, section 5); the DPO hints (special categories, scores about persons, volume) are written in **What** too, and go to the handoff, not to the questions.
