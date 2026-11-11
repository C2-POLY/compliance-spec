# Handoff template

Template of `.compliance/COMPLIANCE.md` (step 9). It is addressed to the owner of the organisation's compliance repo, who copies the blocks there. Fenced YAML blocks carry an info string, `yaml file=<path in the compliance repo>`, so that they can be found and validated. A worked file is in [`example/expected/COMPLIANCE.md`](example/expected/COMPLIANCE.md).

Rules for filling it:

- The `compliance.yaml` block is one entry of `repos` (a list item). Fields only the owner knows are `to complete`. `components` is present when the manifest has `service.components`.
- One `processing.yaml` block per processing activity the findings suggest: the `personal_data` entries that share a purpose, data subjects and legal basis. `services[].data` and `services[].recipients` list ids of this repo's manifest. `recipients` is explicit (`[]` for none).
- `controller` and `dpo`: the controller name from the answers; `contact` is `to complete` unless an answer gave it; no `dpo` unless an answer named one. No `security_measures` unless an answer declared them.
- Every `source` is `declared`, with the manifest as the reference. The files are drafts: the compliance repo owner reviews them in a pull request there.
- A processing whose legal basis was not answered is not given as YAML: describe it in text under "To define".

- **When `service.controller` is `user-of-the-app`**, the organisation is not the controller of what users process locally and keeps no Art. 30 register for it. Say so in section 2, give the `compliance.yaml` entry (the repo is still registered), and propose `processing.yaml` drafts only for what the organisation itself controls (an update server, an OAuth app it owns, a telemetry endpoint), or none (write "None: ..." in section 2).

## Template

````markdown
# Compliance handoff: <repo>

For the owner of `<compliance-owner>/<compliance-repo>`. Prepared by the compliance-init skill from the code of `<owner>/<name>` at commit `<sha>`. It prepares documentation; it does not certify compliance. The manifest of this repo is `.compliance/manifest.yaml`; once this pull request is merged, the workflow sends it to the compliance repo.

## 1. Register the repo

Add this entry to `repos` in `compliance.yaml`:

```yaml file=compliance.yaml
- name: <repo name without owner>
  url: https://github.com/<owner>/<name>
  owner: <team or person to ask, or "to complete">
  expected_to_send: true
  components: [<ids>]
```

## 2. Processing activities

Draft files, one per processing activity. Review, complete and add them under `processings/`.

### <processing name>

Why: <the personal_data entries it groups and why they belong together>.

```yaml file=processings/<id>/processing.yaml
spec_version: "0.1"
id: <id>
name: <name>
purpose: <purpose>
controller: {name: <controller name>, contact: to complete}
data_subjects: [<subjects>]
legal_basis: <basis>
services:
  - repo: <repo name>
    data: [<personal_data ids>]
    recipients: [<processor and outbound flow ids>]
source: {kind: declared, ref: "draft by compliance-init from <repo>/.compliance/manifest.yaml, to be reviewed"}
```

> If the controller is `user-of-the-app`, replace the processing drafts above with: "The controller is the person using the app, so the organisation keeps no register of the processing done locally with their own accounts. Processing drafts below cover only what the organisation itself controls: <list or none>."

## 3. To define

- <a processing with no answered legal basis, or data that fits no processing>

## 4. To complete in the compliance repo

- Controller contact, data protection officer, security measures of each processing (nothing in the code states them).
- The retention each processing applies, if it differs from the stores in the manifest.
- The receiving side: the `receive` workflow and the App that reads this repo (see the compliance-action README), and CODEOWNERS for `services/**`.
````
