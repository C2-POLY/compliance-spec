# Skills

Two skills, used at different times:

| Skill | Use it when |
| --- | --- |
| [`compliance-init`](#compliance-init) | **Once**, on an existing repo that has no `.compliance/manifest.yaml`: it reads the code and writes the first manifest. |
| [`compliance-step`](#compliance-step) | **On every change** after that, in a `/topic` workflow: it asks what the change triggers and keeps the manifest up to date. |

## compliance-step

A step for Claude Code workflows that go from an issue to a pull request (the `/topic` kind). Right after the issue is defined, it checks six triggers on the issue, and on the diff when there is one:

- **a**: a new personal data field (its legal basis question also asks the detail that supports it, for the processing file);
- **b**: a new external service or recipient;
- **c**: a new storage, or a change of retention;
- **d**: an automated decision about a person, or an AI feature;
- **e**: a change to what the persons are told (privacy page, consent banner, screen, email);
- **f**: a change of the organisation's AI Act role or of a feature's risk level.

It asks only the questions of the triggers that fire, in one numbered message. Then it appends a **Compliance** section to the issue (or the single line `GDPR impact: none` when nothing fires) and updates `.compliance/manifest.yaml` (format v0.2) in the same branch, with `source: {kind: spec, ref: <issue url>}` on every item it adds or changes.

It prepares documentation. It does not certify compliance: a person reviews the result.

| File | Content |
| --- | --- |
| [`compliance-step/SKILL.md`](compliance-step/SKILL.md) | The skill: when it runs and the steps |
| [`compliance-step/triggers.md`](compliance-step/triggers.md) | The six triggers: signals, questions, what does not trigger |
| [`compliance-step/triggers.yaml`](compliance-step/triggers.yaml) | Trigger, question, manifest field (checked against the v0.2 schemas by `npm test`) |
| [`compliance-step/scenarios/`](compliance-step/scenarios) | Five worked examples on Bistro Booking, from the v0.2 `bistro-api` manifest of the example: issue, questions, section, manifest |

### Plug it into a `/topic` skill

In the skill that defines the workflow, add this after the issue gate and before the analysis:

```markdown
## 1b. Compliance

After the issue is defined, run the compliance-step skill on it. It asks the GDPR / AI Act
questions the change triggers (none if nothing fires), adds the Compliance section to the issue
and updates `.compliance/manifest.yaml` in the branch. Rerun it on the diff before the pull request.
```

### Install

Copy the folder into your skills directory:

```bash
cp -R skills/compliance-step ~/.claude/skills/            # for all your projects
cp -R skills/compliance-step <repo>/.claude/skills/       # or for one repo
```

The validation step uses `scripts/validate.mjs` of this repo; point the skill at a checkout of compliance-spec, or skip it and let the CI do it.

### Out of scope

Codex and ChatGPT variants of the step. Only the Claude Code skill is provided.

## compliance-init

A one-time skill to adopt the compliance tooling on a repo that already exists. The compliance step only sees changes; on an existing repo nobody has described what the code already does with personal data. This skill does it once, then `/topic` with compliance-step takes over.

It runs in a repo with a clean tree and no manifest, and:

1. **scans** the code ([`scan.md`](compliance-init/scan.md): signals per manifest section, for JS/TS, Python, Go, Rust and Swift, and how to find the rest), and writes `.compliance/findings.md` as evidence; on a large repo it delegates the scan to a read-only sub-agent;
2. **drafts** a v0.2 `.compliance/manifest.yaml` from the findings only: what the code shows gets `source: {kind: code, ref: <path>}`, nothing is invented; it includes the connection data of what persons reach, the notices found in the code, flows linked to their processor, per-component controllers with the privacy by design measures the code shows, and for each AI feature its role, risk and expected obligations;
3. **asks once**, in one message with one question per topic (the controller first, and it blocks until answered; then legal basis, except for a local app whose user is the controller (`not-applicable`), retention, countries, DPAs and where they are, safeguards, accounts, notices the code does not show, AI marking, role and risk), only what the code cannot tell, and records the answers as `declared`; AI features and decisions found in the code are always kept, with conservative values to confirm when the code cannot settle them. The DPO's checks (legal basis detail, DPIA, information, sensitive data, joint controllers) are never asked;
4. sets the root `linked_files` from the files of the findings, and **validates** the manifest;
5. adds `.github/workflows/compliance.yml` (check on pull requests with no secret, send on push to the default branch);
6. writes `.compliance/COMPLIANCE.md`: for the owner of the compliance repo, a v0.2 `compliance.yaml` with the organisation's identity to fill and the repo entry, and draft `processing.yaml` files that inherit the controller and the DPO; for the DPO, the checks of each processing, with the hints of the code;
7. opens **one pull request** from `chore/compliance-init` whose body lists what was found in the code (with files), declared by a person, still unknown, and to confirm. It never pushes to the default branch and never merges.

It prepares documentation. It does not certify compliance: a person reviews the pull request.

| File | Content |
| --- | --- |
| [`compliance-init/SKILL.md`](compliance-init/SKILL.md) | The skill: preconditions, rules and the ten steps |
| [`compliance-init/scan.md`](compliance-init/scan.md) | The scan guide: signals per section, patterns per stack, what never counts, secrets |
| [`compliance-init/findings.md`](compliance-init/findings.md) | Format of `.compliance/findings.md` |
| [`compliance-init/pr-body.md`](compliance-init/pr-body.md) | Template of the pull request body |
| [`compliance-init/compliance-handoff.md`](compliance-init/compliance-handoff.md) | Template of `.compliance/COMPLIANCE.md` |
| [`compliance-init/workflow.yml`](compliance-init/workflow.yml) | Template of `.github/workflows/compliance.yml` |
| [`compliance-init/example/`](compliance-init/example) | A tiny fictional Bistro Booking codebase, and the expected findings, manifest, answers, handoff, workflow and pull request body (checked by `npm test`) |

### Install

```bash
cp -R skills/compliance-init ~/.claude/skills/            # for all your projects
cp -R skills/compliance-init <repo>/.claude/skills/       # or for one repo
```

The skill clones compliance-spec to a temporary folder to run `scripts/validate.mjs` (Node 24 or later); it does not touch your repo for that.

### compliance-init or compliance-step?

- The repo has **no** `.compliance/manifest.yaml`: compliance-init, once.
- The repo has one and a **change** is planned or made: compliance-step, through `/topic`.
- The repo has one that may have **drifted** from the code: neither. Re-checking an existing manifest against the code is a later feature.
