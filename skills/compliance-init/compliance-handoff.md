# Handoff template

Template of `.compliance/COMPLIANCE.md` (step 9). It is addressed to the owner of the organisation's compliance repo, who copies the blocks there, and to the DPO, who settles the checks of section 3. Fenced YAML blocks carry an info string, `yaml file=<path in the compliance repo>`, so that they can be found and validated. A worked file is in [`example/expected/COMPLIANCE.md`](example/expected/COMPLIANCE.md). The target is a v0.2 compliance repo (`spec/compliance-yaml.md`, `spec/compliance-repo.md`).

Rules for filling it:

- The `compliance.yaml` block is a whole v0.2 file: `spec_version: "0.2"`, the `organisation` identity block, and `repos` with the entry of this repo. When the compliance repo already has a `compliance.yaml`, the owner keeps its filled values and adds the `repos` entry.
- `organisation`: `name` from the answer to question 1. `controller` (`legal_name`, `address`, `registration`, `contact`), `dpo`, `representative` and `privacy_contact` come from an answer when one gave them; otherwise text values are `to complete` and `designated` / `required` are `unknown`. They are open items of the dossier until the owner fills them. `components` is present in the repo entry when the manifest has `service.components`.
- One `processing.yaml` block per processing activity the findings suggest: the `personal_data` entries that share a purpose, data subjects and legal basis. `services[].data` and `services[].recipients` list ids of this repo's manifest. `recipients` is explicit (`[]` for none).
- **No `controller` and no `dpo`** in a processing: it inherits them from `organisation` in `compliance.yaml`. Write them only when an answer says that this processing has another controller or DPO.
- `information.notices` names the manifest's notices that tell these persons (`{repo: <repo>, id: <notice id>}`); left out when the manifest has none, which keeps the check open.
- **The DPO checks are not written as values**: no `legal_basis_detail`, `dpia`, `sensitive_data` or `joint_controllers` in the drafts. Section 3 lists them per processing, as items for the DPO, with the hints the code gives. They were never asked to the developer.
- No `security_measures` unless an answer declared them.
- Every `source` is `declared`, with the manifest as the reference. The files are drafts: the compliance repo owner reviews them in a pull request there.
- A processing whose legal basis was not answered is not given as YAML: describe it in text under "To define".

- **When `service.controller` is `user-of-the-app`**, the organisation is not the controller of what users process locally and keeps no Art. 30 register for it. Say so in section 2, give the `compliance.yaml` block (the repo is still registered), and propose `processing.yaml` drafts only for what the organisation itself controls (an update server, an OAuth app it owns, a telemetry endpoint), or none (write "None: ..." in section 2). The same holds for a component whose `controller` is `user-of-the-app`: its data stays out of the drafts, and the dossier lists it under "Outside the register" with `service.controller_rationale`.

## Template

````markdown
# Compliance handoff: <repo>

For the owner of `<compliance-owner>/<compliance-repo>` and the DPO. Prepared by the compliance-init skill from the code of `<owner>/<name>` at commit `<sha>`. It prepares documentation; it does not certify compliance. The manifest of this repo is `.compliance/manifest.yaml`; once this pull request is merged, the workflow sends it to the compliance repo.

## 1. Organisation and repo

The identity of the organisation, to fill once for the whole compliance repo, and the entry of this repo. Every `to complete` and `unknown` is an open item of the dossier until it is filled.

```yaml file=compliance.yaml
spec_version: "0.2"
organisation:
  name: <organisation name>
  controller:
    legal_name: to complete
    address: to complete
    registration: to complete
    contact: to complete
  dpo:
    designated: unknown
  representative:
    required: unknown
  privacy_contact: to complete
repos:
  - name: <repo name without owner>
    url: https://github.com/<owner>/<name>
    owner: <team or person to ask, or "to complete">
    expected_to_send: true
    components: [<ids>]
```

- `controller`: the legal name, address, registration number and data protection contact of the organisation.
- `dpo`: `designated: true` with `name` and `contact`, or `designated: false` with the `reason` no DPO is required.
- `representative`: `required: false` (with a `reason`, e.g. "established in the EU") or `true` with `name` and `contact`.
- `privacy_contact`: where persons exercise their rights (an email address or a URL).

## 2. Processing activities

Draft files, one per processing activity. Review, complete and add them under `processings/`. They inherit the controller and the DPO from `compliance.yaml`.

### <processing name>

Why: <the personal_data entries it groups and why they belong together>.

```yaml file=processings/<id>/processing.yaml
spec_version: "0.2"
id: <id>
name: <name>
purpose: <purpose>
data_subjects: [<subjects>]
legal_basis: <basis>
information:
  notices:
    - {repo: <repo name>, id: <notice id>}
services:
  - repo: <repo name>
    data: [<personal_data ids>]
    recipients: [<processor and outbound flow ids>]
source: {kind: declared, ref: "draft by compliance-init from <repo>/.compliance/manifest.yaml, to be reviewed"}
```

> If the controller is `user-of-the-app`, replace the processing drafts above with: "The controller is the person using the app, so the organisation keeps no register of the processing done locally with their own accounts. Processing drafts below cover only what the organisation itself controls: <list or none>."

## 3. For the DPO

The checks of each processing that the DPO settles in its `processing.yaml`. They were not asked to the developer; until they are written, each is an open item of the dossier. The hints come from the code and the answers.

### <id>

- Legal basis detail (`legal_basis_detail`): <what the basis expects: the contract or law relied on (`reference`), the balancing test (`balancing_test`), or how consent is collected and withdrawn (`consent`)>.
- DPIA (`dpia`): <required yes, no or to-assess, and the criteria the code hints: evaluation, automated-decision, sensitive...>.
- Information of persons (`information`): <the notices already in the draft, or none found>.
- Sensitive data (`sensitive_data`): <none, to-assess, or the special categories the fields may reveal>.
- Joint controllers (`joint_controllers`): <`[]` when there are none, or the partners who decide with the organisation>.

## 4. To define

- <a processing with no answered legal basis, or data that fits no processing>

## 5. To complete in the compliance repo

- Security measures of each processing (nothing in the code states them).
- The retention each processing applies, if it differs from the stores in the manifest.
- The receiving side: the `receive` workflow and the App that reads this repo (see the compliance-action README), and CODEOWNERS for `services/**`.
````
