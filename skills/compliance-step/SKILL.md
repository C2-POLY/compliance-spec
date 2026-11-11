---
name: compliance-step
description: Use right after a change is defined as an issue, and again on the diff if there is one, to ask the few GDPR and AI Act questions the change triggers and keep .compliance/manifest.yaml up to date.
---

# Compliance step

A short step for `/topic`-style workflows. It runs once the issue is defined and accepted (gate 1, "Issues") and before the analysis. It asks nothing when nothing is triggered, and it never leaves the manifest to be rebuilt by hand after deployment.

It prepares documentation. It does not certify compliance and does not replace a Data Protection Officer: a person reviews what it writes.

Files in this folder: [`triggers.md`](triggers.md) (what each trigger means), [`triggers.yaml`](triggers.yaml) (the questions and the manifest field each fills), `scenarios/` (worked examples). The manifest format is the [compliance-spec](https://github.com/C2-POLY/compliance-spec) v0.1 (`spec/manifest.md`).

## Steps

1. **Read.** Read the issue (title, story, context, criteria, out of scope). If a branch or diff exists, read it too (`git diff <base>...HEAD`). Read `.compliance/manifest.yaml` of the repo; if it does not exist, say so and create it from the schema (`spec_version: "0.1"`, `service` filled from the README, the six lists `[]`).
2. **Evaluate the triggers.** For each trigger in `triggers.yaml` (a: personal data field, b: external service, c: storage or retention, d: automated decision or AI), compare the signals in `triggers.md` with the issue and the diff. Read the current `.compliance/manifest.yaml` first: data, recipients and stores it already lists for the same purpose and legal basis are not new and do not fire a trigger. Write down which fired and why. If you are unsure, fire it.
3. **Ask only the fired questions.** Take the questions of the fired triggers from `triggers.yaml`, drop those the issue or the diff already answers (state the answer back instead), and send them in **one message, numbered**, each with its id (`a1`, `b2`...). Do not ask about triggers that did not fire. Wait for the answers.
4. **Never guess.** An unanswered or unknown question is not filled in with a likely value. Write `unknown` where the schema allows it (`dpa`, `retention.duration`, country of an outbound flow); leave `legal_basis` out; otherwise add a line `TODO: <question id> <question>` to the Compliance section and do not touch that field.
5. **Write the section into the issue body** (`gh issue edit <n> --body-file`), at the end:

   - if at least one trigger fired:

     ```
     **Compliance**

     - <trigger name>: <what changes, in one line, with the ids written to the manifest>
     - <one line per fired trigger>

     Manifest: updated in this branch
     ```

     `TODO:` lines for unanswered questions go between the trigger lines and the `Manifest:` line.

   - if nothing fired, two lines and nothing else:

     ```
     GDPR impact: none
     <One line naming why none fired, e.g. "No trigger fired: the change only alters the colour of a button.">
     ```

6. **Update the manifest in the same branch** (`.compliance/manifest.yaml`). Skip this step when nothing fired.
   - Add or change only the items the answers concern. Every item you add or change gets `source: {kind: spec, ref: <issue url>}`, including a store whose `data` list you extend. Never touch other items.
   - Ids are lowercase with hyphens, unique within their list. Every `data` entry refers to an existing `personal_data` id.
   - A new `processors` entry comes with a matching `outbound_flows` entry (`account: organisation`); a recipient reached with the user's own account is an `outbound_flows` entry only.
   - Add the files the change touches to `linked_files` (item and root) when they are not covered yet.
7. **Validate.** Run `node <spec>/scripts/validate.mjs .compliance/manifest.yaml` (`<spec>` is a checkout of compliance-spec, or the path the repo's CI uses). If that script is not available, say so in the report and re-read the YAML against `spec/manifest.md`. Fix errors before going on. Do not report the step as done on an invalid manifest.
8. **Report** to the workflow: which triggers fired (or none), what was written to the issue and the manifest, the `TODO` questions still open. Open `TODO` questions are carried to the plan gate.

## Rules

- English output, even when the conversation is in another language, unless the repo's house rules say otherwise.
- Questions are plain: no article numbers, no legal jargon in what you ask. The article names stay in `triggers.md`.
- Never write personal data (real names, numbers, emails) into the issue or the manifest: the manifest describes categories of data, not values.
- Do not change a schema, a spec file or an existing item's meaning to make an answer fit. If the format cannot express the answer, write a `TODO` and say so.
- One run per issue. If the issue changes later, run the step again; it replaces its own Compliance section instead of adding a second one.
