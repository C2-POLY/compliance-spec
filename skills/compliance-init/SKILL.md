---
name: compliance-init
description: Use once to adopt the compliance tooling on an existing repo, by drafting its first .compliance/manifest.yaml from the code and opening a pull request, after which /topic with compliance-step takes over.
---

# Compliance init

A one-time skill. A repo that already exists has nobody who described what its code does with personal data, so the compliance step (which only sees changes) has nothing to build on. This skill reads the code, writes the **first** manifest from what it finds, asks the person only what the code cannot tell, and delivers everything in one pull request. From then on, `/topic` with the [compliance-step](../compliance-step/SKILL.md) skill takes over for every change.

It prepares documentation. It does not certify compliance and does not replace a Data Protection Officer: a person reviews the pull request, and the compliance repo records that review.

Files in this folder: [`scan.md`](scan.md) (what to look for, per section of the manifest), [`findings.md`](findings.md) (the format of the evidence file), [`pr-body.md`](pr-body.md) (the pull request body), [`compliance-handoff.md`](compliance-handoff.md) (the file for the compliance repo owner), [`workflow.yml`](workflow.yml) (the GitHub workflow), `example/` (a fictional repo and the expected result, used by `npm test`). The manifest format is [compliance-spec](https://github.com/C2-POLY/compliance-spec) v0.1 (`spec/manifest.md`).

## Rules

- **Nothing is invented.** Every value in the manifest comes from a finding or from an answer. A gap is a question, then `unknown` or left out, never a likely value.
- **Never touch the default branch.** Work on `chore/compliance-init`. Never push to the default branch, never force-push, never merge, never enable auto-merge. The person merges.
- **No secret, no personal value** in any file, question, commit or pull request. Follow `scan.md`, section 7.
- English output, unless the host repo's house rules say otherwise. Questions are plain: no article numbers, no legal jargon.
- Respect the host repo: read its `CLAUDE.md`, `AGENTS.md` and `CONTRIBUTING.md` before the first commit, and follow them for branch names, commit messages, pull request titles and trailers. The defaults below apply only where the host says nothing.
- Do not change a schema, a spec file or anything outside `.compliance/` and `.github/workflows/compliance.yml`.

## Steps

1. **Preconditions.** Check, and stop with a one-line reason if one fails:
   - inside a git repo (`git rev-parse --show-toplevel`); work from its root;
   - clean tree (`git status --porcelain` prints nothing);
   - no `.compliance/manifest.yaml`. If one exists, stop and say: this skill is for a first manifest; changes go through compliance-step;
   - no `.github/workflows/compliance.yml`. If one exists, keep it and say so in the final report, and skip step 8;
   - `gh auth status` works, if you will open the pull request; if not, do every step but the push, and say so.

   Note the default branch (`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`, or `git symbolic-ref --short refs/remotes/origin/HEAD`) and the commit scanned (`git rev-parse HEAD`).

2. **Scan.** Follow [`scan.md`](scan.md) and write `.compliance/findings.md` in the format of [`findings.md`](findings.md). On a large repo (more than a few hundred source files, or several deliverables), delegate the scan to a **read-only sub-agent**: give it `scan.md` and `findings.md`, the repo path, and the instruction to write nothing and to return the findings file as text. Read its answer against the code for at least the processors and storage rows before you rely on it. Write the file yourself.

3. **Draft the manifest** from the findings only (`spec_version: "0.1"`, the six lists, an empty list where nothing was found). Keep it as a working draft: **do not write `.compliance/manifest.yaml` to disk until the controller question (step 4, question 1) is answered**, because `service.controller` has no `unknown`.
   - `service`: `name`, `description` and `repo` (`owner/name` from the git remote) from the README and the package files; `components` when the repo holds several deliverables.
   - Ids are lowercase with hyphens, unique in their list. Every `data` entry names an existing `personal_data` id.
   - A finding with confidence `found` or `inferred` becomes an item with `source: {kind: code, ref: "<path>"}`. `ref` is the path of the file relative to the repo root; several files are comma-separated (`"src/db.ts, migrations/001.sql"`). The format defines no line anchor and no glob in `ref`: the line stays in `findings.md`. Use the file that best shows the item, and no file under a test, fixture or mock folder.
   - Use the categories and the `processors` / `outbound_flows` split of `scan.md` (sections 2 and 4).
   - **Gaps.** `legal_basis` is left out (until question 1 is answered: see step 5 for `user-of-the-app`); `dpa: unknown`; an outbound flow `to.country: unknown`; `retention.duration: unknown` only when the code shows nothing about deletion or expiry.
   - **Retention from the code.** When the code shows the event that deletes the data (sign-out deletes the token, the user removes an entry, a TTL), write it: the TTL as an ISO duration, or `duration: none` (kept until the event) with the event as `trigger`, `source: code`. `session` is only for data held in memory. A file the app writes and never deletes itself (a file in the user's repository, an export) is `duration: none` with the trigger "until the person deletes it": an undo right after the write is not a retention rule. See `scan.md`, section 3.
   - **Processor with a missing required value.** The schema does not allow `unknown` for a processor's `country` or `transfer_outside_eu`: until they are answered, write the recipient as an `outbound_flows` entry only (`account: organisation`, `country: unknown`) and list it under "still unknown".
   - **A flow that sends no personal data** (only the IP address and technical headers, as any HTTP call does) is an `outbound_flows` entry with `data: []` and a `purpose` that says so ("update check; sends only the IP address and the technical headers"). The schema allows it. Do not drop such a flow.
   - **AI features and automated decisions are never dropped once found.** Fill `generates_content`, `interacts_with_persons` and `human_review` (decisions: `human_review`) from the code and record them in the findings as `found` or `inferred`: a person who must click to apply a result means `human_review: true`; a result applied with no step in between means `false`. Ask only what the code cannot tell (`marking`; `human_review` when unclear). A required boolean the code cannot settle takes the **conservative value**: `human_review: false`, `legal_or_similar_effect: true`. Write it, and list it under "To confirm" in the pull request; never silently. `ai_features: []` and `automated_decisions: []` mean only that none was found.

4. **Ask once.** Send **one numbered message**, **one question per topic**, not one per item. Each question lists the items it covers as a list to fill in. Ask only what the code cannot tell and the findings raise; state back what the code already answers; skip a topic with no finding. Reuse the wording of the compliance step (`../compliance-step/triggers.yaml`) where it fits. The `#` column below is the order, not the final numbering: number the questions you actually ask 1, 2, 3… in that order.

   **Question 1 is the controller and is blocking:** say that nothing is written until it is answered, and ask again if it is skipped. Give a hint from the code, but the person decides (a local app with no server of the organisation, calling services with the user's own accounts, suggests `user-of-the-app`; a server run by the organisation suggests `organisation`).

   | # | Topic | Ask when | Covers (one line per item) |
   | --- | --- | --- | --- |
   | 1 | Controller (blocking): `organisation`, `user-of-the-app` or `shared` | always | the service |
   | 2 | Who is answering (a role is enough; recorded as the source of the answers) | always | |
   | 3 | Legal basis (a4), only if the controller turns out to be `organisation` or `shared` | any `personal_data` | every `personal_data` id |
   | 4 | Retention, start event and region (c1, c3, c4) | any `storage` whose retention the code does not show | every store |
   | 5 | Country of each recipient, and the safeguard if outside the EU/EEA (b2) | any processor or flow | every processor and every outbound flow |
   | 6 | Data processing agreement signed (b3) | any processor | every processor |
   | 7 | Whose account is used | flows whose `account` is inferred | every such flow, with the inferred value to confirm |
   | 8 | Human review (d3), legal effect (d2), marking (d4) | an AI feature or decision the code leaves unclear | every such item, only the missing parts |

   Format of the message (items listed under each question, to fill in):

   ```
   3. Only if the controller is the organisation or shared: legal basis (consent, contract, legal obligation, legitimate interests, other, or not known yet) for:
      - guest-contact:
      - booking-details:
   4. How long is the data kept, what event starts the clock, and in which region is it hosted, for:
      - main-db:
   ```

   Say that "unknown" or "skip" is a valid answer (except question 1). Wait for the reply. An answer the person does not give stays a gap.

5. **Record the answers.** Update the manifest:
   - Write `.compliance/manifest.yaml` now that question 1 is answered. `service.controller` comes from the answer, and the `service` item carries `source: {kind: declared, ref: "<README or package file>; controller answered by <who answered> during compliance-init"}`.
   - **When question 1 is answered `user-of-the-app`**, the organisation is not the controller of what the user processes locally (`spec/manifest.md`, `service`): every `personal_data` entry gets `legal_basis: not-applicable # follows from question 1`, and any answer to question 3 is ignored. Do not list legal bases as gaps, in the pull request or in the handoff.
   - Values that complete an item found in the code (legal basis, retention, region, country, DPA, safeguard, review, marking) are written into that item. Its `source` stays `code` (it says where the item comes from), and each value gets a trailing YAML comment `# declared: question <n>, <who answered>`.
   - An item that exists **only** because of an answer (a store the person named, a recipient the code does not show) gets `source: {kind: declared, ref: "answered by <who answered> during compliance-init"}`.
   - A value the code does not settle and that you set to the conservative value, or an `account` the person confirmed, is listed in "To confirm" in the pull request.
   - If an answer contradicts the code, the code wins: keep the code value and list the contradiction in the pull request.
   - Keep a record of questions and answers for the pull request.

6. **`linked_files`.** Set the root `linked_files` from the files of the findings (`Where` column of `.compliance/findings.md`): relative to the repo root. **Collapse to `dir/**` only when the files of the findings are at least half of the files of that folder (for example 2 of 3, or 4 of 8), or when the folder is a dedicated module (named after one feature, nothing unrelated in it). Otherwise list the files one by one** (1 of 10 files in `src/` stays a single path, not `src/**`). Count tracked files with `git ls-files <dir> | wc -l`. Add `linked_files` to an item when its files are few and specific. No test, fixture or documentation file.

7. **Validate.** Get the script outside the repo, once:

   ```bash
   git clone --depth 1 https://github.com/C2-POLY/compliance-spec "${TMPDIR:-/tmp}/compliance-spec"
   (cd "${TMPDIR:-/tmp}/compliance-spec" && npm ci)       # Node 24 or later
   node "${TMPDIR:-/tmp}/compliance-spec/scripts/validate.mjs" .compliance/manifest.yaml
   ```

   If a checkout of compliance-spec already exists, run its `scripts/validate.mjs` instead. The script checks the schema, unique ids and that every `data` and `component` reference resolves. Fix every error. Then check by hand the rules it cannot see: every `code` ref is a file that exists; no `code` ref is in a test or fixture folder; every `linked_files` entry matches at least one file. Do not report the step done on an invalid manifest. If the script cannot be run at all, say so and re-read the manifest against `spec/manifest.md`.

8. **Workflow.** Copy [`workflow.yml`](workflow.yml) to `.github/workflows/compliance.yml` and fill the placeholders:
   - `<compliance-owner>/<compliance-repo>`: the organisation's compliance repo (ask it as the last question of the step 4 message if the repo's README, docs or `.github` do not name it; if unknown, leave the placeholder and say so);
   - `<compliance-owner>` for the App token owner, `COMPLIANCE_APP_ID` and `COMPLIANCE_APP_PRIVATE_KEY` stay as variable and secret **names**: never write a value;
   - pin every action by full commit SHA with the version in a comment. Resolve it with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`, for `actions/checkout` (`v5`) and `actions/create-github-app-token` (`v2`). That call returns the **commit** SHA, also when the tag is annotated (do not use the tag object's own SHA);
   - pin `C2-POLY/compliance-action` the same way to the commit of its `v1` tag once the tag exists. Until then, use the SHA of `main` (`gh api repos/C2-POLY/compliance-action/commits/main --jq .sha`) and keep the `TODO` comment of the template above that line, so the pin is moved later;
   - if you cannot resolve a SHA, leave `<full-sha>` and list it in the pull request as to do.

   The `check` job runs on pull requests and uses no secret. The `send` job runs on pushes to the default branch, in the `compliance` environment. Change `branches: [main]` if the default branch has another name.

9. **Handoff to the compliance repo.** Write `.compliance/COMPLIANCE.md` from [`compliance-handoff.md`](compliance-handoff.md):
   - the `repos` entry of `compliance.yaml` for this repo (name, URL, `owner` from the answers or `to complete`, `expected_to_send: true`, `components` if the manifest has them);
   - a draft `processings/<id>/processing.yaml` for each processing activity the findings suggest: group the `personal_data` entries that share a purpose, subjects and legal basis; each `services` entry names this repo, its `data` ids and the `recipients` ids (processors and outbound flows) that belong to it. Fields only a person knows (`controller.contact`, `dpo`, `security_measures`) are `to complete` or left out. A processing whose legal basis is not answered is described in text, not in YAML (the schema requires one);
   - **When the controller is `user-of-the-app`**, the organisation keeps no Art. 30 register for what users process locally: say so in the file, give the `compliance.yaml` entry, and propose processing drafts only for what the organisation itself controls (an update server, an OAuth app it owns), or none;
   - each YAML block is fenced with an info string: ` ```yaml file=compliance.yaml ` or ` ```yaml file=processings/<id>/processing.yaml `.

   Validate the blocks the same way: write each processing block to a temporary file outside the repo and run `validate.mjs --schema processing <file>`; for the `compliance.yaml` entry, wrap it in a minimal document (`spec_version`, `organisation.name`, `repos: [<entry>]`) and run `validate.mjs --schema compliance <file>`.

10. **Deliver.** Never on the default branch.
    - `git switch -c chore/compliance-init` from the default branch (the host's naming rules win).
    - Stage exactly `.compliance/` and `.github/workflows/compliance.yml`, and nothing else (`git status --short` to check).
    - Commit with the host's commit convention. Default: Conventional Commits, `chore: add the initial compliance manifest`, with a short body saying that the manifest is drafted from the code and is not a compliance certificate. No AI attribution unless the host asks for it.
    - `git push -u origin chore/compliance-init`. Check `git branch --show-current` is not the default branch before pushing. No `--force`.
    - Write the body from [`pr-body.md`](pr-body.md) to a temporary file outside the repo, then `gh pr create --base <default> --head chore/compliance-init --title "<host convention; default: chore: add the initial compliance manifest>" --body-file <file>`. No auto-merge, no `gh pr merge`, no label or assignee the host did not ask for.
    - If the push or `gh` is not possible (no remote, no permission), stop after the commit and tell the person the exact commands left.

11. **Report** in the conversation: the pull request URL (or the commands left), the counts (items per section, answered, still unknown), the questions left open, the validation result, and anything not done. Say again that it prepares documentation and does not certify compliance. If you met a committed credential or a real-looking personal value (scan.md, section 7), say it here, with file and line and no value, and only here.

## After this skill

The manifest is a reviewed baseline, not a finished register. For each following change, `/topic` runs compliance-step, which asks the questions a change triggers and updates `.compliance/manifest.yaml` in the same branch. Run compliance-init again only on a repo that has no manifest.
