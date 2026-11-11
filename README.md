# compliance-spec

An open format to describe, repo by repo, what a software service does with personal data, so that GDPR and AI Act documentation can be generated from the code and the specs instead of being rebuilt by hand after deployment.

> **Status: draft.** Nothing is stable yet. The first version of the format will be tagged `v0.1.0`.

## What it covers

- **Manifest**: one `.compliance/manifest.yaml` per repo: personal data, processors, storage, retention, outbound flows, automated decisions. Every value says where it comes from: the code, a spec, or a human declaration.
- **Compliance repo**: one repository per organisation that holds no code. It gathers the manifests of every repo, organised by processing activity rather than by repo, plus the generated documents.
- **`compliance.yaml`**: the list of repos and external tools that make up the information system.
- **JSON Schemas** for each of these files.
- **A compliance step for `/topic`-style skills**: it asks targeted GDPR / AI Act questions at spec time, and only when a change triggers them.
- **A skill to start from existing code**: it scans a repo, writes its first manifest, asks only what the code cannot tell and opens a pull request.
- **A base template** for the records of processing activities (GDPR Art. 30).

## Layout

| Folder | Content |
| --- | --- |
| `spec/` | The format, in prose |
| `schema/` | JSON Schemas, versioned by folder |
| `skills/` | The compliance step for `/topic`: [`skills/compliance-step`](skills/compliance-step) (triggers, questions, scenarios); and the one-time first manifest of an existing repo: [`skills/compliance-init`](skills/compliance-init) (scan guide, findings, pull request, example) |
| `templates/` | Document templates: [`templates/register`](templates/register) (records of processing, GDPR Art. 30(1): items, mapping, provenance, template) |
| `scripts/` | `validate.mjs` (check a file against its schema), `missing-services.mjs`, `check-triggers.mjs` (the compliance step's field paths exist in the schema) |
| `tests/` | Fixtures (valid and invalid) and the test runner |
| `examples/` | A complete example for a fictional restaurant booking app, « Bistro Booking » |

## Validate

Needs Node 24 or later.

```bash
npm ci && npm test                      # schemas, fixtures, examples, scripts
node scripts/validate.mjs <file>        # check one file; the schema is picked from the file name
node scripts/validate.mjs --schema manifest <file>
node scripts/missing-services.mjs <compliance-repo-dir>
```

## Related

- [compliance-action](https://github.com/C2-POLY/compliance-action): the GitHub Action that checks the manifest on pull requests and sends it to the compliance repo on merge.

## Disclaimer

This project prepares documentation. It does not certify compliance and does not replace a Data Protection Officer: a human reviews and validates.

## Licence

[Apache 2.0](LICENSE)
