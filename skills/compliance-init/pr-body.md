# Pull request body

The body of the pull request of step 10. Fill every placeholder; keep the headings, in this order (the first three lists are required; "To confirm" is dropped when empty). Use the host repo's own template or conventions first when it has some, and keep these three lists inside it. A worked body is in [`example/expected/pr-body.md`](example/expected/pr-body.md).

Lists hold one line per manifest item or value, with the item as `<section>/<id>`. No secret, no personal value.

## Template

````markdown
## Summary

First compliance manifest of `<repo>`, drafted from the code by the compliance-init skill, and the workflow that keeps it in step with the code. It prepares documentation; it does not certify compliance. Nothing here is validated until a person reviews it.

Scanned commit: `<sha>`. Evidence: `.compliance/findings.md`.

## Found in the code

What the code shows. Each line names the files; check the line numbers in `.compliance/findings.md`.

- `<section>/<id>`: <what>, in `<path>`, `<path>`

## Declared by a person

What the code does not show; it comes from <who answered>, in answer to the questions asked during the run. Recorded in the manifest with a `declared` source or a `# declared: question <n>` comment.

- `<section>/<id>.<field>` = `<value>` (question <n>)

## Still unknown

What nobody answered and the code does not tell. Left out or `unknown` in the manifest.

- `<section>/<id>.<field>`: <what is missing, and who could answer>
- Not in the manifest until answered: <decision or AI feature, with the reason>

## To confirm

Values set by the skill that nobody settled: a conservative default (`human_review: false`, `legal_or_similar_effect: true`, an AI obligation `open`), a value inferred from the code (a privacy by design measure), or an account the code only suggests. They are in the manifest; check them.

- `<section>/<id>.<field>` = `<value>`: <why it was set, and what to check>

## What this adds

- `.compliance/manifest.yaml`: the manifest (<n> personal data, <n> stores, <n> processors, <n> outbound flows, <n> decisions, <n> AI features, <n> notices).
- `.compliance/findings.md`: the findings it was drafted from.
- `.compliance/COMPLIANCE.md`: for the owner of the compliance repo, the `compliance.yaml` with the organisation's identity to fill and this repo's entry, and draft processing files; for the DPO, the checks of each processing (legal basis detail, DPIA, information, sensitive data, joint controllers), which were not asked here.
- `.github/workflows/compliance.yml`: checks the manifest on pull requests (no secret), sends it to the compliance repo on pushes to `<default branch>`.

## Reviewer checklist

- [ ] Each line of "Found in the code" matches the code; nothing is missing (a store, a provider, an AI call).
- [ ] Each declared value is right, and the person who gave it is the right one to give it.
- [ ] Each "To confirm" value is right, or corrected.
- [ ] Each "Still unknown" has an owner and a date, or a decision to leave it.
- [ ] Contradictions between an answer and the code (below, if any) are settled; the code wins.
- [ ] The workflow: `<compliance-owner>/<compliance-repo>`, the `compliance` environment and the App secrets exist; actions are pinned by SHA.
- [ ] `.compliance/COMPLIANCE.md` is handed to the owner of the compliance repo, and its section 3 to the DPO.
- [ ] No secret or personal data in the files.
````

The skill removes the "Contradictions" mention from the checklist when there are none.
