# Skills

## compliance-step

A step for Claude Code workflows that go from an issue to a pull request (the `/topic` kind). Right after the issue is defined, it checks four triggers on the issue, and on the diff when there is one:

- **a**: a new personal data field;
- **b**: a new external service or recipient;
- **c**: a new storage, or a change of retention;
- **d**: an automated decision about a person, or an AI feature.

It asks only the questions of the triggers that fire, in one numbered message. Then it appends a **Compliance** section to the issue (or the single line `GDPR impact: none` when nothing fires) and updates `.compliance/manifest.yaml` in the same branch, with `source: {kind: spec, ref: <issue url>}` on every item it adds or changes.

It prepares documentation. It does not certify compliance: a person reviews the result.

| File | Content |
| --- | --- |
| [`compliance-step/SKILL.md`](compliance-step/SKILL.md) | The skill: when it runs and the steps |
| [`compliance-step/triggers.md`](compliance-step/triggers.md) | The four triggers: signals, questions, what does not trigger |
| [`compliance-step/triggers.yaml`](compliance-step/triggers.yaml) | Trigger, question, manifest field (checked against the schema by `npm test`) |
| [`compliance-step/scenarios/`](compliance-step/scenarios) | Three worked examples on Bistro Booking: issue, questions, section, manifest |

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
