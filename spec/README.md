# Specification

> Status: draft. Current version: **v0.2**. v0.1 files stay valid: every file declares its own `spec_version`, and the validator picks [`schema/v0.2/`](../schema/v0.2/) or [`schema/v0.1/`](../schema/v0.1/) from it.

| Document | What it defines | Schemas |
| --- | --- | --- |
| [manifest.md](manifest.md) | The manifest of one repo or declared tool: personal data, storage, processors, flows, decisions, AI features, and in v0.2 notices, component controllers and the AI Act role, risk and obligations | `manifest.schema.json` |
| [compliance-repo.md](compliance-repo.md) | The compliance repo: layout, versions, processing files and their DPO checks (v0.2), sync records, anchors | `processing`, `sync`, `anchors` |
| [compliance-yaml.md](compliance-yaml.md) | `compliance.yaml`: the repos and tools, and in v0.2 the organisation's identity | `compliance.schema.json` |
| [templates/register](../templates/register/README.md) | The generated document: the v0.1 records of processing, the v0.2 compliance dossier (open items, actions, English and French) | none |

Fields new in v0.2 are marked **(v0.2)** in each document. In a v0.2 compliance repo, a missing v0.2 field is an open item of the dossier, never a validation error.

The specification prepares documentation; it does not certify compliance.
