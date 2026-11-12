# compliance.yaml, v0.2

> Status: draft. Schemas: [`schema/v0.2/compliance.schema.json`](../schema/v0.2/compliance.schema.json) and [`schema/v0.1/compliance.schema.json`](../schema/v0.1/compliance.schema.json).

`compliance.yaml` sits at the root of the compliance repo (see [compliance-repo.md](compliance-repo.md)). It states who the organisation is, and lists the repos and the external tools that make up its information system. It is written by a human.

Its `spec_version` is the version of the whole compliance repo: `"0.2"` gives the v0.2 dossier, `"0.1"` the v0.1 register (see [compliance-repo.md](compliance-repo.md#versions)). Fields marked **(v0.2)** are new in v0.2 and rejected in a v0.1 file.

```yaml
spec_version: "0.2"

organisation:
  name: Bistro Booking Group
  controller:
    legal_name: Bistro Booking Group SAS
    address: 12 rue des Tables, 75011 Paris, France
    registration: "RCS Paris 900 000 000"
    contact: privacy@bistro-booking.example
  dpo:
    designated: true
    name: Data protection office
    contact: dpo@bistro-booking.example
  representative:
    required: unknown
  privacy_contact: privacy@bistro-booking.example

repos:
  - name: bistro-api
    url: https://github.com/bistro-org/bistro-api
    owner: platform team
    expected_to_send: true
    components: [api, worker]
  - name: bistro-analytics
    url: https://github.com/bistro-org/bistro-analytics
    owner: data team
    expected_to_send: false

declared_tools:
  - id: crm
    name: ClientDesk CRM
    path: declared/crm/manifest.yaml
```

## Fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `spec_version` | string | yes | `"0.2"` (or `"0.1"`). |
| `organisation.name` | string | yes | Name of the organisation. |
| `organisation.controller` | object | no | **(v0.2)** The controller's identity (GDPR Art. 30(1)(a)). See below. |
| `organisation.dpo` | object | no | **(v0.2)** The data protection officer (Art. 37 to 39). See below. |
| `organisation.representative` | object | no | **(v0.2)** The representative in the Union (Art. 27). See below. |
| `organisation.privacy_contact` | string | no | **(v0.2)** Where persons exercise their rights: an email address or a URL. |
| `repos` | list | yes | The repos of the information system. May be `[]`. |
| `declared_tools` | list | no | External tools with a hand-declared manifest. |

`repos[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Repo name without owner (`^[A-Za-z0-9_.-]+$`). Also the folder name under `services/`. |
| `url` | URI | yes | Where the repo is. |
| `owner` | string | yes | The person or team to ask about it. |
| `expected_to_send` | boolean | yes | `true`: the repo handles personal data and must send a manifest. `false`: a decision was taken that it does not; the line records that decision. |
| `components` | list of ids | no | The component ids the repo's manifest declares, when it holds several deliverables. |

`declared_tools[]`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | id | yes | `^[a-z0-9][a-z0-9-]*$`; referenced by `tool:` in processings; equals the folder name under `declared/`. |
| `name` | string | yes | Human name. |
| `path` | string | yes | `declared/<id>/manifest.yaml`. |

## Organisation identity (v0.2)

`organisation.controller`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `legal_name` | string | yes | The legal name of the controller. |
| `address` | string | no | Its postal address. |
| `registration` | string | no | Its registration number: "RCS Paris 900 000 000". |
| `contact` | string | yes | How to reach it about personal data. |

`organisation.dpo`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `designated` | `true` \| `false` \| `unknown` | yes | Whether a DPO is designated. |
| `name`, `contact` | string | when `designated: true` | The DPO (a person or a team) and how to reach them. |
| `reason` | string | when `designated: false` | Why no DPO is required (Art. 37(1)). |

`organisation.representative`:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `required` | `true` \| `false` \| `unknown` | yes | Whether Art. 27 requires a representative in the Union. |
| `name`, `contact` | string | when `required: true` | The representative. |
| `reason` | string | no | Why none is required, when `required: false`: "established in the EU". |

### Inheritance

A processing file may state its own `controller` and `dpo` (see [compliance-repo.md](compliance-repo.md)). When it does, its value wins; when it does not, the dossier uses `organisation.controller` and `organisation.dpo`. The Source column says which: `declared: compliance.yaml`, or `declared: <the source.ref of the processing file>`. The representative and the privacy contact are only stated here.

### Open items

A gap is an open item of the dossier, never a validation error:

- no controller for a processing (neither its own nor `organisation.controller`), or one of its values written `to complete` (any case);
- no DPO for a processing (neither its own `dpo` nor `organisation.dpo`), or `designated: unknown`;
- `organisation.representative` absent or `required: unknown`.

The exact rules, and the actions that close them, are in [`templates/register/README.md`](../templates/register/README.md#v02-the-compliance-dossier).

## Missing services

A repo with `expected_to_send: true` and no `services/<name>/` folder is **missing**: it was declared as part of the system, but it never sent its manifest (or the Action is not installed). This is detectable from the files alone, without calling GitHub.

```
node scripts/missing-services.mjs <compliance-repo-dir>
```

The script prints one line per missing repo (`missing: <name> (owner: <owner>)`) and exits `1` if there is any, `0` otherwise (`2` if `compliance.yaml` cannot be read). It checks that the folder exists; whether the manifest inside is valid is the job of `validate.mjs`. Run it in the compliance repo's CI to turn a silent gap into a failed check.

`expected_to_send: false` repos are never reported. They stay in the list so that a reviewer sees that the repo was considered.
