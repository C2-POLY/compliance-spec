# compliance-spec

An open format to describe, repo by repo, what a software service does with personal data, so that GDPR and AI Act documentation can be generated from the code and the specs instead of being rebuilt by hand after deployment.

> **Status: draft.** Nothing is stable yet. The first version of the format will be tagged `v0.1.0`.

## What it covers

- **Manifest**: one `.compliance/manifest.yaml` per repo: personal data, processors, storage, retention, outbound flows, automated decisions. Every value says where it comes from: the code, a spec, or a human declaration.
- **Compliance repo**: one repository per organisation that holds no code. It gathers the manifests of every repo, organised by processing activity rather than by repo, plus the generated documents.
- **`compliance.yaml`**: the list of repos and external tools that make up the information system.
- **JSON Schemas** for each of these files.
- **A compliance step for `/topic`-style skills**: it asks targeted GDPR / AI Act questions at spec time, and only when a change triggers them.
- **A base template** for the records of processing activities (GDPR Art. 30).

## Layout

| Folder | Content |
| --- | --- |
| `spec/` | The format, in prose |
| `schema/` | JSON Schemas, versioned by folder |
| `skills/` | The compliance step for `/topic` |
| `templates/` | Document templates (records of processing) |
| `examples/` | A complete example for a fictional restaurant booking app, « Bistro Booking » |

## Related

- [compliance-action](https://github.com/C2-POLY/compliance-action): the GitHub Action that checks the manifest on pull requests and sends it to the compliance repo on merge.

## Disclaimer

This project prepares documentation. It does not certify compliance and does not replace a Data Protection Officer: a human reviews and validates.

## Licence

[Apache 2.0](LICENSE)
